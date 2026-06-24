using Microsoft.EntityFrameworkCore;
using Moxic.Core.DTOs;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Endpoints;

public static class GameEndpoints
{
    public static void MapGameEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/games").WithTags("Games");

        group.MapGet("/", async (MoxicDbContext dbContext, IMinioService minioService, int page = 1, int pageSize = 20) =>
        {
            var query = dbContext.Games.AsNoTracking();
            var total = await query.CountAsync();
            var items = await query
                .Include(g => g.Media)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = new List<GameListItemDto>();
            foreach (var game in items)
            {
                var primaryMedia = game.Media.FirstOrDefault(m => m.IsPrimary);
                string? coverUrl = null;
                if (primaryMedia != null)
                {
                    try { coverUrl = await minioService.GetPresignedUrlAsync("moxic-games", primaryMedia.ObjectKey); } catch { }
                }

                dtos.Add(new GameListItemDto
                {
                    Id = game.Id,
                    Name = game.Name,
                    OriginalPrice = game.OriginalPrice,
                    SalePrice = game.SalePrice,
                    Genre = game.Genre,
                    Tags = game.Tags,
                    Status = game.Status.ToString(),
                    ReleaseDate = game.ReleaseDate,
                    CoverImageUrl = coverUrl
                });
            }

            return Results.Ok(new { items = dtos, total, page, pageSize });
        });

        group.MapGet("/featured", async (MoxicDbContext dbContext, IMinioService minioService, int limit = 5) =>
        {
            var items = await dbContext.Games.AsNoTracking()
                .Include(g => g.Media)
                .Where(g => g.IsFeatured)
                .Take(limit)
                .ToListAsync();

            var dtos = new List<GameListItemDto>();
            foreach (var game in items)
            {
                var primaryMedia = game.Media.FirstOrDefault(m => m.IsPrimary);
                string? coverUrl = null;
                if (primaryMedia != null)
                {
                    try { coverUrl = await minioService.GetPresignedUrlAsync("moxic-games", primaryMedia.ObjectKey); } catch { }
                }

                dtos.Add(new GameListItemDto
                {
                    Id = game.Id,
                    Name = game.Name,
                    OriginalPrice = game.OriginalPrice,
                    SalePrice = game.SalePrice,
                    Genre = game.Genre,
                    Tags = game.Tags,
                    Status = game.Status.ToString(),
                    ReleaseDate = game.ReleaseDate,
                    CoverImageUrl = coverUrl
                });
            }

            return Results.Ok(dtos);
        });

        group.MapGet("/{id:guid}", async (Guid id, MoxicDbContext dbContext, IMinioService minioService) =>
        {
            var game = await dbContext.Games.AsNoTracking()
                .Include(g => g.Media)
                .FirstOrDefaultAsync(g => g.Id == id);

            if (game == null) return Results.NotFound();

            var mediaDtos = new List<GameMediaDto>();
            foreach (var m in game.Media.OrderBy(m => m.DisplayOrder))
            {
                string? url = null;
                try { url = await minioService.GetPresignedUrlAsync("moxic-games", m.ObjectKey); } catch { }
                
                mediaDtos.Add(new GameMediaDto
                {
                    Id = m.Id,
                    ObjectKey = m.ObjectKey,
                    IsPrimary = m.IsPrimary,
                    DisplayOrder = m.DisplayOrder,
                    PresignedUrl = url
                });
            }

            var dto = new GameDetailDto
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
                Ratings = game.Ratings,
                SystemRequirements = game.SystemRequirements,
                Media = mediaDtos
            };

            return Results.Ok(dto);
        });
    }
}
