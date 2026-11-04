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
    private readonly PushService _push;

    public NotificationService(MoxicDbContext db, UserManager<IdentityUser> users, ILogger<NotificationService> logger, PushService push)
    {
        _push = push;
        _db = db;
        _users = users;
        _logger = logger;
    }

    /// <summary>True when the customer last used the English site (profile language).</summary>
    public async Task<bool> IsEnglishAsync(string? userId) =>
        !string.IsNullOrEmpty(userId) && await _db.CustomerProfiles.AsNoTracking().AnyAsync(p => p.UserId == userId && p.Lang == "en");

    /// <summary>Adds a notification in the customer's language: make(en) returns the title and body.</summary>
    public async Task AddLocalizedAsync(string userId, string type, Func<bool, (string Title, string? Body)> make, string? link = null)
    {
        var (title, body) = make(await IsEnglishAsync(userId));
        await AddAsync(userId, type, title, body, link);
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
            // Also to the customer's phones/browsers (PWA push).
            _push.Enqueue(userId, title, body, link);
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
