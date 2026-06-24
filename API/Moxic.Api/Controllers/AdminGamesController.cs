using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;
using Moxic.Api.Models;

namespace Moxic.Api.Controllers;

[Route("api/admin/games")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminGamesController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public AdminGamesController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    // GET /api/admin/games
    [HttpGet]
    public async Task<IActionResult> GetGames([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.Games.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(g => g.Name.Contains(search));

        var games = await query
            .OrderByDescending(g => g.CreatedAt)
            .Include(g => g.Media)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        var items = new List<AdminGameListItem>();
        foreach (var g in games)
        {
            var primaryMedia = g.Media.FirstOrDefault(m => m.IsPrimary);
            string? primaryImage = null;
            if (primaryMedia != null)
                primaryImage = await _minio.GetPresignedUrlAsync(gamesBucket, primaryMedia.ObjectKey, expiry);

            items.Add(new AdminGameListItem
            {
                Id = g.Id, Name = g.Name, OriginalPrice = g.OriginalPrice,
                SalePrice = g.SalePrice, Genre = g.Genre, Tags = g.Tags,
                Status = g.Status.ToString(), ReleaseDate = g.ReleaseDate,
                ImageCount = g.Media.Count, PrimaryImage = primaryImage,
                CreatedAt = g.CreatedAt, UpdatedAt = g.UpdatedAt
            });
        }

        return Ok(items);
    }

    // POST /api/admin/games
    [HttpPost]
    public async Task<IActionResult> CreateGame([FromBody] CreateGameDto dto)
    {
        var game = new Game
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            OriginalPrice = dto.OriginalPrice,
            SalePrice = dto.SalePrice,
            Genre = dto.Genre,
            Tags = dto.Tags ?? string.Empty,
            Status = dto.Status,
            ReleaseDate = dto.ReleaseDate,
            IsFeatured = dto.IsFeatured,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (dto.SystemRequirements != null)
        {
            game.SystemRequirements = new SystemRequirementData
            {
                Minimum = dto.SystemRequirements.Minimum != null ? new SystemRequirement
                {
                    Os = dto.SystemRequirements.Minimum.Os ?? string.Empty,
                    Processor = dto.SystemRequirements.Minimum.Processor ?? string.Empty,
                    Memory = dto.SystemRequirements.Minimum.Memory ?? string.Empty,
                    Graphics = dto.SystemRequirements.Minimum.Graphics ?? string.Empty,
                    Storage = dto.SystemRequirements.Minimum.Storage ?? string.Empty
                } : new SystemRequirement(),
                Recommended = dto.SystemRequirements.Recommended != null ? new SystemRequirement
                {
                    Os = dto.SystemRequirements.Recommended.Os ?? string.Empty,
                    Processor = dto.SystemRequirements.Recommended.Processor ?? string.Empty,
                    Memory = dto.SystemRequirements.Recommended.Memory ?? string.Empty,
                    Graphics = dto.SystemRequirements.Recommended.Graphics ?? string.Empty,
                    Storage = dto.SystemRequirements.Recommended.Storage ?? string.Empty
                } : new SystemRequirement()
            };
        }

        if (dto.Ratings.Count > 0)
        {
            game.Ratings = dto.Ratings.Select(r => new GameRating
            {
                Source = r.Source ?? string.Empty,
                Score = r.Score,
                MaxScore = r.MaxScore,
                Label = r.Label ?? string.Empty
            }).ToList();
        }

        _db.Games.Add(game);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetGame), new { id = game.Id }, new { game.Id });
    }

    // GET /api/admin/games/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetGame(Guid id)
    {
        var game = await _db.Games
            .Include(g => g.Media.OrderBy(m => m.DisplayOrder))
            .FirstOrDefaultAsync(g => g.Id == id);

        if (game == null) return NotFound();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        var mediaItems = new List<AdminGameMediaItem>();
        foreach (var media in game.Media)
        {
            var presignedUrl = await _minio.GetPresignedUrlAsync(gamesBucket, media.ObjectKey, expiry);
            mediaItems.Add(new AdminGameMediaItem
            {
                Id = media.Id,
                ObjectKey = media.ObjectKey,
                IsPrimary = media.IsPrimary,
                DisplayOrder = media.DisplayOrder,
                PresignedUrl = presignedUrl
            });
        }

        return Ok(new AdminGameDetailResponse
        {
            Id = game.Id,
            Name = game.Name,
            Description = game.Description,
            OriginalPrice = game.OriginalPrice,
            SalePrice = game.SalePrice,
            Genre = game.Genre,
            Tags = game.Tags,
            Status = game.Status.ToString(),
            ReleaseDate = game.ReleaseDate,
            IsFeatured = game.IsFeatured,
            SystemRequirements = game.SystemRequirements != null
                ? new SystemRequirementDataDto
                {
                    Minimum = new SystemRequirementDto
                    {
                        Os = game.SystemRequirements.Minimum.Os,
                        Processor = game.SystemRequirements.Minimum.Processor,
                        Memory = game.SystemRequirements.Minimum.Memory,
                        Graphics = game.SystemRequirements.Minimum.Graphics,
                        Storage = game.SystemRequirements.Minimum.Storage
                    },
                    Recommended = new SystemRequirementDto
                    {
                        Os = game.SystemRequirements.Recommended.Os,
                        Processor = game.SystemRequirements.Recommended.Processor,
                        Memory = game.SystemRequirements.Recommended.Memory,
                        Graphics = game.SystemRequirements.Recommended.Graphics,
                        Storage = game.SystemRequirements.Recommended.Storage
                    }
                } : null,
            Ratings = game.Ratings.Select(r => new GameRatingDto
            {
                Source = r.Source,
                Score = r.Score,
                MaxScore = r.MaxScore,
                Label = r.Label
            }).ToList(),
            Media = mediaItems,
            CreatedAt = game.CreatedAt,
            UpdatedAt = game.UpdatedAt
        });
    }

    // PUT /api/admin/games/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateGame(Guid id, [FromBody] UpdateGameDto dto)
    {
        var game = await _db.Games.FindAsync(id);
        if (game == null) return NotFound();

        game.Name = dto.Name;
        game.Description = dto.Description;
        game.OriginalPrice = dto.OriginalPrice;
        game.SalePrice = dto.SalePrice;
        game.Genre = dto.Genre;
        game.Tags = dto.Tags ?? string.Empty;
        game.Status = dto.Status;
        game.ReleaseDate = dto.ReleaseDate;
        game.IsFeatured = dto.IsFeatured;
        game.UpdatedAt = DateTime.UtcNow;

        if (dto.SystemRequirements != null)
        {
            game.SystemRequirements = new SystemRequirementData
            {
                Minimum = dto.SystemRequirements.Minimum != null ? new SystemRequirement
                {
                    Os = dto.SystemRequirements.Minimum.Os ?? string.Empty,
                    Processor = dto.SystemRequirements.Minimum.Processor ?? string.Empty,
                    Memory = dto.SystemRequirements.Minimum.Memory ?? string.Empty,
                    Graphics = dto.SystemRequirements.Minimum.Graphics ?? string.Empty,
                    Storage = dto.SystemRequirements.Minimum.Storage ?? string.Empty
                } : new SystemRequirement(),
                Recommended = dto.SystemRequirements.Recommended != null ? new SystemRequirement
                {
                    Os = dto.SystemRequirements.Recommended.Os ?? string.Empty,
                    Processor = dto.SystemRequirements.Recommended.Processor ?? string.Empty,
                    Memory = dto.SystemRequirements.Recommended.Memory ?? string.Empty,
                    Graphics = dto.SystemRequirements.Recommended.Graphics ?? string.Empty,
                    Storage = dto.SystemRequirements.Recommended.Storage ?? string.Empty
                } : new SystemRequirement()
            };
        }

        if (dto.Ratings.Count > 0)
        {
            game.Ratings = dto.Ratings.Select(r => new GameRating
            {
                Source = r.Source ?? string.Empty,
                Score = r.Score,
                MaxScore = r.MaxScore,
                Label = r.Label ?? string.Empty
            }).ToList();
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/admin/games/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGame(Guid id)
    {
        var game = await _db.Games.Include(g => g.Media).FirstOrDefaultAsync(g => g.Id == id);
        if (game == null) return NotFound();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        foreach (var media in game.Media)
            await _minio.DeleteObjectAsync(gamesBucket, media.ObjectKey);

        _db.Games.Remove(game);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/admin/games/{id}/media
    [HttpPost("{id:guid}/media")]
    public async Task<IActionResult> UploadMedia(Guid id, IFormFile file)
    {
        var game = await _db.Games.FindAsync(id);
        if (game == null) return NotFound();
        if (file.Length == 0) return BadRequest("File is empty");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("File too large (max 5MB)");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp")
            return BadRequest("Invalid file type (jpg, png, webp only)");

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var objectKey = $"games/{id}/{Guid.NewGuid()}{ext}";

        using var stream = file.OpenReadStream();
        await _minio.UploadImageAsync(gamesBucket, objectKey, stream, file.ContentType);

        var media = new GameMedia
        {
            Id = Guid.NewGuid(),
            GameId = id,
            ObjectKey = objectKey,
            IsPrimary = !await _db.GameMedias.AnyAsync(m => m.GameId == id),
            DisplayOrder = await _db.GameMedias.CountAsync(m => m.GameId == id),
            CreatedAt = DateTime.UtcNow
        };

        _db.GameMedias.Add(media);
        await _db.SaveChangesAsync();

        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        var presignedUrl = await _minio.GetPresignedUrlAsync(gamesBucket, objectKey, expiry);

        return Ok(new { media.Id, media.ObjectKey, media.IsPrimary, media.DisplayOrder, PresignedUrl = presignedUrl });
    }

    // DELETE /api/admin/games/{id}/media/{mediaId}
    [HttpDelete("{id:guid}/media/{mediaId:guid}")]
    public async Task<IActionResult> DeleteMedia(Guid id, Guid mediaId)
    {
        var media = await _db.GameMedias.FirstOrDefaultAsync(m => m.Id == mediaId && m.GameId == id);
        if (media == null) return NotFound();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        await _minio.DeleteObjectAsync(gamesBucket, media.ObjectKey);

        _db.GameMedias.Remove(media);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/admin/games/{id}/media/{mediaId}/primary
    [HttpPut("{id:guid}/media/{mediaId:guid}/primary")]
    public async Task<IActionResult> SetPrimaryMedia(Guid id, Guid mediaId)
    {
        var media = await _db.GameMedias.FirstOrDefaultAsync(m => m.Id == mediaId && m.GameId == id);
        if (media == null) return NotFound();

        var currentPrimary = await _db.GameMedias.Where(m => m.GameId == id && m.IsPrimary).ToListAsync();
        foreach (var mp in currentPrimary) mp.IsPrimary = false;
        media.IsPrimary = true;

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
