using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>Public: announcements currently visible in the storefront pop-up.</summary>
[Route("api/announcements")]
[ApiController]
public class AnnouncementsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public AnnouncementsController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    // GET /api/announcements/active
    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var now = DateTime.UtcNow;
        var rows = await _db.Announcements.AsNoTracking()
            .Include(a => a.Game).ThenInclude(g => g!.Media)
            .Where(a => a.IsActive
                        && (a.StartsAt == null || a.StartsAt <= now)
                        && (a.EndsAt == null || a.EndsAt > now))
            .OrderByDescending(a => a.Priority).ThenByDescending(a => a.UpdatedAt)
            .Take(5)
            .ToListAsync();

        var items = new List<AnnouncementDto>();
        foreach (var a in rows) items.Add(await AnnouncementMapper.ToDtoAsync(a, _minio));
        return Ok(new { items, serverNow = now });
    }
}
