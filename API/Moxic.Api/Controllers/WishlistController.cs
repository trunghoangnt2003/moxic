using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.DTOs;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record WishlistMergeRequest(List<Guid>? GameIds);

/// <summary>"Yêu thích": the signed-in customer's saved games.</summary>
[Route("api/account/wishlist")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class WishlistController : ControllerBase
{
    private const int MaxItems = 200;

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public WishlistController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    // GET /api/account/wishlist
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var rows = await _db.WishlistItems.AsNoTracking()
            .Where(w => w.UserId == UserId)
            .OrderByDescending(w => w.CreatedAt)
            .Include(w => w.Game).ThenInclude(g => g.Media)
            .Include(w => w.Game).ThenInclude(g => g.Genres)
            .AsSplitQuery()
            .ToListAsync();

        var items = new List<GameListItemDto>();
        foreach (var w in rows)
        {
            var g = w.Game;
            var media = g.Media.FirstOrDefault(m => m.IsPrimary) ?? g.Media.OrderBy(m => m.DisplayOrder).FirstOrDefault();
            string? cover = null;
            if (media != null)
            {
                try { cover = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, media.ObjectKey); } catch { }
            }
            items.Add(new GameListItemDto
            {
                Id = g.Id,
                Name = g.Name,
                OriginalPrice = g.OriginalPrice,
                SalePrice = g.SalePrice,
                Genres = g.Genres.Select(x => new GenreDto(x.Id, x.Name)).ToList(),
                Status = g.Status.ToString(),
                ReleaseDate = g.ReleaseDate,
                CoverImageUrl = cover
            });
        }
        return Ok(new { ids = rows.Select(r => r.GameId), items });
    }

    // PUT /api/account/wishlist/{gameId}
    [HttpPut("{gameId:guid}")]
    public async Task<IActionResult> Add(Guid gameId)
    {
        if (!await _db.Games.AnyAsync(g => g.Id == gameId)) return NotFound(new { error = "Không tìm thấy game." });
        if (await _db.WishlistItems.CountAsync(w => w.UserId == UserId) >= MaxItems)
            return BadRequest(new { error = $"Danh sách yêu thích tối đa {MaxItems} game." });

        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "WishlistItems" ("UserId", "GameId", "CreatedAt") VALUES ({UserId}, {gameId}, {DateTime.UtcNow}) ON CONFLICT DO NOTHING""");
        return NoContent();
    }

    // DELETE /api/account/wishlist/{gameId}
    [HttpDelete("{gameId:guid}")]
    public async Task<IActionResult> Remove(Guid gameId)
    {
        await _db.WishlistItems.Where(w => w.UserId == UserId && w.GameId == gameId).ExecuteDeleteAsync();
        return NoContent();
    }

    // POST /api/account/wishlist/merge { gameIds } — import a guest's local list after login
    [HttpPost("merge")]
    public async Task<IActionResult> Merge([FromBody] WishlistMergeRequest request)
    {
        var ids = (request.GameIds ?? new()).Distinct().Take(MaxItems).ToList();
        if (ids.Count > 0)
        {
            var valid = await _db.Games.Where(g => ids.Contains(g.Id)).Select(g => g.Id).ToListAsync();
            var now = DateTime.UtcNow;
            foreach (var id in valid)
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $"""INSERT INTO "WishlistItems" ("UserId", "GameId", "CreatedAt") VALUES ({UserId}, {id}, {now}) ON CONFLICT DO NOTHING""");
            }
        }
        return await Get();
    }
}
