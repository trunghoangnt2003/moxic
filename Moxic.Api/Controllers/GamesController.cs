using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class GamesController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public GamesController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    // GET /api/games — public list
    [HttpGet]
    public async Task<IActionResult> GetGames(
        [FromQuery] string? genre,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Games.AsQueryable();

        if (!string.IsNullOrWhiteSpace(genre))
            query = query.Where(g => g.Genre == genre);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<GameStatus>(status, true, out var gs))
            query = query.Where(g => g.Status == gs);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(g => g.Name.Contains(search));

        var total = await query.CountAsync();
        var games = await query
            .OrderByDescending(g => g.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(g => g.Media)
            .ToListAsync();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        var items = games.Select(g =>
        {
            var primary = g.Media.FirstOrDefault(m => m.IsPrimary);
            return new GameListItemDto
            {
                Id = g.Id,
                Name = g.Name,
                OriginalPrice = g.OriginalPrice,
                SalePrice = g.SalePrice,
                Genre = g.Genre,
                Tags = g.Tags,
                Status = g.Status.ToString(),
                ReleaseDate = g.ReleaseDate,
                CoverImageUrl = primary != null
                    ? _minio.GetPresignedUrlAsync(gamesBucket, primary.ObjectKey, expiry).Result
                    : null
            };
        }).ToList();

        return Ok(new { items, total, page, pageSize });
    }

    // GET /api/games/{id} — public detail
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetGame(Guid id)
    {
        var game = await _db.Games
            .Include(g => g.Media.OrderBy(m => m.DisplayOrder))
            .FirstOrDefaultAsync(g => g.Id == id);

        if (game == null) return NotFound();

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        var mediaUrls = game.Media.Select(m => new GameMediaDto
        {
            Id = m.Id,
            ObjectKey = m.ObjectKey,
            IsPrimary = m.IsPrimary,
            DisplayOrder = m.DisplayOrder,
            PresignedUrl = _minio.GetPresignedUrlAsync(gamesBucket, m.ObjectKey, expiry).Result
        }).ToList();

        return Ok(new GameDetailDto
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
            Media = mediaUrls
        });
    }
}

// DTOs
public record GameListItemDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string Tags { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime? ReleaseDate { get; init; }
    public string? CoverImageUrl { get; init; }
}

public record GameDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string Tags { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime? ReleaseDate { get; init; }
    public List<GameMediaDto> Media { get; init; } = new();
}

public record GameMediaDto
{
    public Guid Id { get; init; }
    public string ObjectKey { get; init; } = string.Empty;
    public bool IsPrimary { get; init; }
    public int DisplayOrder { get; init; }
    public string? PresignedUrl { get; init; }
}
