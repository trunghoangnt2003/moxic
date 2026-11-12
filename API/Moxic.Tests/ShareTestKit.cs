using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Tests;

/// <summary>Records share events so tests can assert who was told what.</summary>
public class RecordingShareEvents : IShareEvents
{
    public List<string> Events { get; } = new();
    public Task MemberJoined(ShareRoom r, ShareSeat s) { Events.Add($"joined:{s.UserId}"); return Task.CompletedTask; }
    public Task RoomFull(ShareRoom r) { Events.Add("full"); return Task.CompletedTask; }
    public Task SeatPaid(ShareRoom r, ShareSeat s) { Events.Add($"paid:{s.UserId}"); return Task.CompletedTask; }
    public Task RoomFunded(ShareRoom r, Order o) { Events.Add($"funded:{o.OrderCode}"); return Task.CompletedTask; }
    public Task PayReminder(ShareRoom r, ShareSeat s) { Events.Add($"remind:{s.UserId}"); return Task.CompletedTask; }
    public Task SeatRemoved(ShareRoom r, ShareSeat s, string reason) { Events.Add($"removed:{s.UserId}:{reason}"); return Task.CompletedTask; }
    public Task RoomCancelled(ShareRoom r) { Events.Add("cancelled"); return Task.CompletedTask; }
    public Task Refunded(ShareRoom r, ShareSeat s) { Events.Add($"refunded:{s.UserId}"); return Task.CompletedTask; }
    public Task MessageReported(ShareRoom r, ShareMessage m) { Events.Add("reported"); return Task.CompletedTask; }
    public Task TransferProblem(string html) { Events.Add("problem"); return Task.CompletedTask; }
}

public static class ShareTestKit
{
    public static readonly CustomerIdentity A = new("user-a", "a@test.vn", "Minh");
    public static readonly CustomerIdentity B = new("user-b", "b@test.vn", "Hoàng");
    public static readonly CustomerIdentity C = new("user-c", "c@test.vn", "Lan");

    public static IDataProtectionProvider Protection { get; } = new EphemeralDataProtectionProvider();

    public static ShareRoomService Service(MoxicDbContext ctx, RecordingShareEvents? events = null) =>
        new(ctx, new CouponService(ctx, NullLogger<CouponService>.Instance), Protection, events ?? new RecordingShareEvents(),
            NullLogger<ShareRoomService>.Instance);

    public static async Task<Game> SeedGameAsync(MoxicDbContext ctx, decimal price = 900000, bool allowShare = true, int rewardPoints = 100)
    {
        var now = DateTime.UtcNow;
        var g = new Game
        {
            Id = Guid.NewGuid(), Name = "Forza Horizon 5", Description = "", OriginalPrice = price * 2, SalePrice = price,
            AllowShare = allowShare, RewardPoints = rewardPoints, Status = GameStatus.Available, CreatedAt = now, UpdatedAt = now,
        };
        ctx.Games.Add(g);
        await ctx.SaveChangesAsync();
        return g;
    }

    public static CreateShareRoomRequest Req(Game g, int percent = 60, string accountType = "Owner", bool isPublic = true) =>
        new(g.Id, null, accountType, percent, isPublic);

    /// <summary>A creates (60/40, Owner account, Xbox set), B joins: a Full room ready to pay.</summary>
    public static async Task<ShareRoom> FullRoomAsync(MoxicDbContext ctx, ShareRoomService svc, int percent = 60, string accountType = "Owner")
    {
        var g = await SeedGameAsync(ctx);
        var (room, err) = await svc.CreateAsync(A, Req(g, percent, accountType));
        Assert.Null(err);
        if (accountType == "Owner")
            Assert.Null((await svc.SetOwnerXboxAsync(room!.Code, A.UserId, "xbox@a.vn", "secret")).Error);
        var (joined, jerr) = await svc.JoinAsync(room!.Code, B);
        Assert.Null(jerr);
        return joined!;
    }

    public static BankTransaction Tx(decimal amount, string content, string? id = null) => new()
    {
        Id = Guid.NewGuid(), Provider = "sepay", ProviderTxnId = id ?? Guid.NewGuid().ToString("N"), Amount = amount,
        Content = content, CreatedAt = DateTime.UtcNow,
    };

    public static async Task<ShareSeat> SeatAsync(MoxicDbContext ctx, string code, string userId) =>
        await ctx.ShareSeats.AsNoTracking().SingleAsync(s => s.Room!.Code == code && s.UserId == userId && s.LeftAt == null);
}
