using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record AdminEditionDto(Guid? Id, string? Name, string? Includes, decimal OriginalPrice, decimal SalePrice, bool IsDefault, bool IsActive, int DisplayOrder);

public record AdminGameCatalogDto(string ProductType, string? Region, string? Publisher, string? Developer, List<AdminEditionDto> Editions);

/// <summary>Product classification (type/region/publisher) and editions of a game.</summary>
[Route("api/admin/games/{id:guid}/catalog")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminGameCatalogController : ControllerBase
{
    public static readonly string[] ProductTypes = { "Game", "GamePass", "GiftCard", "DLC", "Bundle" };

    private readonly MoxicDbContext _db;

    public AdminGameCatalogController(MoxicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(Guid id)
    {
        var game = await _db.Games.AsNoTracking().Include(g => g.Editions).FirstOrDefaultAsync(g => g.Id == id);
        if (game == null) return NotFound(new { error = "Không tìm thấy game." });
        return Ok(ToDto(game));
    }

    [HttpPut]
    public async Task<IActionResult> Put(Guid id, [FromBody] AdminGameCatalogDto dto)
    {
        var game = await _db.Games.Include(g => g.Editions).FirstOrDefaultAsync(g => g.Id == id);
        if (game == null) return NotFound(new { error = "Không tìm thấy game." });

        var type = ProductTypes.FirstOrDefault(t => string.Equals(t, dto.ProductType, StringComparison.OrdinalIgnoreCase));
        if (type == null) return BadRequest(new { error = "Loại sản phẩm không hợp lệ." });

        string? Clean(string? v, int max) => string.IsNullOrWhiteSpace(v) ? null : v.Trim()[..Math.Min(v.Trim().Length, max)];

        var incoming = dto.Editions ?? new();
        if (incoming.Count > 10) return BadRequest(new { error = "Tối đa 10 phiên bản." });
        foreach (var e in incoming)
        {
            var name = (e.Name ?? string.Empty).Trim();
            if (name.Length < 1 || name.Length > 60) return BadRequest(new { error = "Tên phiên bản phải từ 1–60 ký tự." });
            if (e.SalePrice < 0 || e.OriginalPrice < 0) return BadRequest(new { error = "Giá không được âm." });
            if (e.OriginalPrice > 0 && e.SalePrice > e.OriginalPrice)
                return BadRequest(new { error = $"Giá bán của \"{name}\" không được lớn hơn giá gốc." });
        }
        if (incoming.Select(e => e.Name!.Trim().ToLowerInvariant()).Distinct().Count() != incoming.Count)
            return BadRequest(new { error = "Tên phiên bản bị trùng." });

        game.ProductType = type;
        game.Region = Clean(dto.Region, 30);
        game.Publisher = Clean(dto.Publisher, 100);
        game.Developer = Clean(dto.Developer, 100);

        // Replace editions: update matching ids, add new ones, remove the rest.
        var now = DateTime.UtcNow;
        var keepIds = incoming.Where(e => e.Id.HasValue).Select(e => e.Id!.Value).ToHashSet();
        foreach (var stale in game.Editions.Where(e => !keepIds.Contains(e.Id)).ToList()) _db.GameEditions.Remove(stale);

        var order = 0;
        var active = incoming.Where(e => e.IsActive).ToList();
        var defaultName = (active.FirstOrDefault(e => e.IsDefault) ?? active.FirstOrDefault())?.Name?.Trim();
        foreach (var e in incoming)
        {
            var entity = e.Id.HasValue ? game.Editions.FirstOrDefault(x => x.Id == e.Id.Value) : null;
            if (entity == null)
            {
                entity = new GameEdition { Id = Guid.NewGuid(), GameId = game.Id, CreatedAt = now };
                _db.GameEditions.Add(entity);
            }
            entity.Name = e.Name!.Trim();
            entity.Includes = Clean(e.Includes, 2000);
            entity.OriginalPrice = e.OriginalPrice;
            entity.SalePrice = e.SalePrice;
            entity.IsActive = e.IsActive;
            entity.IsDefault = e.IsActive && entity.Name == defaultName;
            entity.DisplayOrder = order++;
            entity.UpdatedAt = now;
        }

        // Keep the game's list price = default edition, so filters/sorting/cards stay consistent.
        var def = active.FirstOrDefault(e => e.Name?.Trim() == defaultName);
        if (def != null)
        {
            game.SalePrice = def.SalePrice;
            game.OriginalPrice = def.OriginalPrice;
        }
        game.UpdatedAt = now;

        await _db.SaveChangesAsync();
        var fresh = await _db.Games.AsNoTracking().Include(g => g.Editions).FirstAsync(g => g.Id == id);
        return Ok(ToDto(fresh));
    }

    private static AdminGameCatalogDto ToDto(Game g) => new(
        g.ProductType, g.Region, g.Publisher, g.Developer,
        g.Editions.OrderBy(e => e.DisplayOrder)
            .Select(e => new AdminEditionDto(e.Id, e.Name, e.Includes, e.OriginalPrice, e.SalePrice, e.IsDefault, e.IsActive, e.DisplayOrder))
            .ToList());
}
