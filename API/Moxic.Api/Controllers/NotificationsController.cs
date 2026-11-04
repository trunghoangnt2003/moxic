using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>The customer's navbar-bell notifications.</summary>
[Route("api/notifications")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class NotificationsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public NotificationsController(MoxicDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var items = await _db.Notifications.AsNoTracking()
            .Where(n => n.UserId == UserId)
            .OrderByDescending(n => n.CreatedAt).Take(30)
            .Select(n => new { n.Id, n.Type, n.Title, n.Body, n.Link, read = n.ReadAt != null, n.CreatedAt })
            .ToListAsync();
        var unread = await _db.Notifications.CountAsync(n => n.UserId == UserId && n.ReadAt == null);
        return Ok(new { unread, items });
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id)
    {
        await _db.Notifications.Where(n => n.Id == id && n.UserId == UserId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        await _db.Notifications.Where(n => n.UserId == UserId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return NoContent();
    }
}
