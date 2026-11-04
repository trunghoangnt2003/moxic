using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>Writes navbar-bell notifications. Failures never break the calling operation.</summary>
public class NotificationService
{
    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _users;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(MoxicDbContext db, UserManager<IdentityUser> users, ILogger<NotificationService> logger)
    {
        _db = db;
        _users = users;
        _logger = logger;
    }

    public async Task AddAsync(string userId, string type, string title, string? body = null, string? link = null)
    {
        if (string.IsNullOrEmpty(userId)) return;
        try
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "Notifications" ("Id", "UserId", "Type", "Title", "Body", "Link", "CreatedAt")
                VALUES ({Guid.NewGuid()}, {userId}, {type}, {Cut(title, 150)}, {(body == null ? null : Cut(body, 500))}, {link}, {DateTime.UtcNow})
                """);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Notification for {UserId} failed", userId);
        }
    }

    /// <summary>The customer an order belongs to: its CustomerId, else the verified account with the order email.</summary>
    public async Task<string?> ResolveOrderCustomerAsync(Order order)
    {
        if (!string.IsNullOrEmpty(order.CustomerId)) return order.CustomerId;
        var email = order.CustomerXboxEmail?.Trim();
        if (string.IsNullOrEmpty(email)) return null;
        var user = await _users.FindByEmailAsync(email);
        return user != null && user.EmailConfirmed && await _users.IsInRoleAsync(user, CustomerAuthRules.CustomerRole) ? user.Id : null;
    }

    private static string Cut(string s, int max) => s.Length > max ? s[..max] : s;
}
