using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public record CustomerIdentity(string UserId, string Email, string DisplayName);

/// <summary>Shared helpers for reviews/comments: who is the (optional) customer, did they buy the game.</summary>
public class CommunityService
{
    public static readonly OrderStatus[] PaidStatuses =
        { OrderStatus.Verifying, OrderStatus.Installing, OrderStatus.ActionRequired, OrderStatus.Completed };

    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _users;

    public CommunityService(MoxicDbContext db, UserManager<IdentityUser> users)
    {
        _db = db;
        _users = users;
    }

    /// <summary>Reads the customer cookie even on anonymous endpoints. Null when not signed in/verified.</summary>
    public async Task<CustomerIdentity?> GetCustomerAsync(HttpContext ctx)
    {
        var result = await ctx.AuthenticateAsync(CustomerAuthRules.Scheme);
        var userId = result.Succeeded ? result.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) : null;
        if (string.IsNullOrEmpty(userId)) return null;
        var user = await _users.FindByIdAsync(userId);
        if (user == null || !user.EmailConfirmed) return null;
        var name = await _db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == userId).Select(p => p.DisplayName).FirstOrDefaultAsync();
        return new CustomerIdentity(userId, user.Email ?? string.Empty, string.IsNullOrWhiteSpace(name) ? (user.Email ?? "Khách").Split('@')[0] : name);
    }

    public Task<bool> HasPurchasedAsync(CustomerIdentity c, Guid gameId)
    {
        var email = c.Email.ToLower();
        return _db.OrderDetails.AsNoTracking().AnyAsync(d => d.GameId == gameId
            && PaidStatuses.Contains(d.Order.Status)
            && (d.Order.CustomerId == c.UserId || d.Order.CustomerXboxEmail.ToLower() == email));
    }
}
