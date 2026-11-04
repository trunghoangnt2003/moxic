using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>Slot availability, atomic asset reservation, codes and credential protection for rentals.</summary>
public class RentalService
{
    /// <summary>A PendingPayment rental holds its slot this long before it is auto-cancelled.</summary>
    public static readonly TimeSpan PaymentHold = TimeSpan.FromMinutes(30);
    /// <summary>Reminder email is sent this long before a rental ends.</summary>
    public static readonly TimeSpan ReminderBefore = TimeSpan.FromHours(24);

    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly MoxicDbContext _db;
    private readonly IDataProtector _protector;

    public RentalService(MoxicDbContext db, IDataProtectionProvider dp)
    {
        _db = db;
        _protector = dp.CreateProtector("RentalAssetPassword");
    }

    public string Protect(string password) => _protector.Protect(password);

    public string? Unprotect(string encrypted)
    {
        try { return _protector.Unprotect(encrypted); } catch { return null; }
    }

    public static string NewCode(string prefix = "RENT") =>
        $"{prefix}-{DateTime.UtcNow.AddHours(7):yyMMdd}-{RandomNumberGenerator.GetString(CodeAlphabet, 5)}";

    /// <summary>Total and free slots across active assets that own the game.</summary>
    public async Task<(int Total, int Free)> GetAvailabilityAsync(Guid gameId)
    {
        var assets = await _db.RentalAssets.AsNoTracking()
            .Where(a => a.IsActive && a.Games.Any(g => g.GameId == gameId))
            .Select(a => new
            {
                a.Slots,
                Used = _db.RentalOrders.Count(r => r.AssetId == a.Id && r.Kind == "Rental" && RentalStatus.Occupying.Contains(r.Status))
            })
            .ToListAsync();
        return (assets.Sum(a => a.Slots), assets.Sum(a => Math.Max(0, a.Slots - a.Used)));
    }

    /// <summary>
    /// Picks an asset with a free slot for the game and locks it (SELECT … FOR UPDATE) so two
    /// concurrent reservations can't take the same last slot. Must run inside a transaction.
    /// </summary>
    public async Task<Guid?> ReserveAssetAsync(Guid gameId)
    {
        var candidates = await _db.RentalAssets.AsNoTracking()
            .Where(a => a.IsActive && a.Games.Any(g => g.GameId == gameId))
            .Select(a => new
            {
                a.Id,
                a.Slots,
                Used = _db.RentalOrders.Count(r => r.AssetId == a.Id && r.Kind == "Rental" && RentalStatus.Occupying.Contains(r.Status))
            })
            .Where(a => a.Used < a.Slots)
            .OrderBy(a => a.Used).ThenBy(a => a.Id)
            .ToListAsync();

        foreach (var c in candidates)
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "RentalAssets" WHERE "Id" = {c.Id} FOR UPDATE""");
            var used = await _db.RentalOrders.CountAsync(r => r.AssetId == c.Id && r.Kind == "Rental" && RentalStatus.Occupying.Contains(r.Status));
            if (used < c.Slots) return c.Id;
        }
        return null;
    }
}
