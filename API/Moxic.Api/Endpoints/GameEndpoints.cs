using Microsoft.EntityFrameworkCore;
using Moxic.Core.DTOs;
using Moxic.Core.Entities;
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
                .Include(g => g.Genres)
                .Include(g => g.Tags)
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
                    Genres = game.Genres.Select(g => new GenreDto(g.Id, g.Name)).ToList(),
                    Tags = game.Tags.Select(t => new TagDto(t.Id, t.Name)).ToList(),
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
                .Include(g => g.Genres)
                .Include(g => g.Tags)
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
                    Genres = game.Genres.Select(g => new GenreDto(g.Id, g.Name)).ToList(),
                    Tags = game.Tags.Select(t => new TagDto(t.Id, t.Name)).ToList(),
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
                .Include(g => g.Genres)
                .Include(g => g.Tags)
                .Include(g => g.Reviews)
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

            var purchaseCount = await dbContext.OrderDetails
                .CountAsync(od => od.GameId == id);

            var storeRating = game.Reviews.Count > 0
                ? Math.Round(game.Reviews.Average(r => r.Rating), 1)
                : 5.0;

            var dto = new GameDetailDto
            {
                Id = game.Id,
                Name = game.Name,
                Description = game.Description,
                OriginalPrice = game.OriginalPrice,
                SalePrice = game.SalePrice,
                Genres = game.Genres.Select(g => new GenreDto(g.Id, g.Name)).ToList(),
                Tags = game.Tags.Select(t => new TagDto(t.Id, t.Name)).ToList(),
                Status = game.Status.ToString(),
                ReleaseDate = game.ReleaseDate,
                Ratings = game.Ratings,
                SystemRequirements = game.SystemRequirements,
                Media = mediaDtos,
                PurchaseCount = purchaseCount,
                StoreRating = storeRating,
                Reviews = game.Reviews
                    .OrderByDescending(r => r.CreatedAt)
                    .Take(8)
                    .Select(r => new GameReviewDto
                    {
                        Id = r.Id,
                        UserName = r.UserName,
                        AvatarUrl = r.AvatarUrl,
                        Rating = r.Rating,
                        Content = r.Content,
                        CreatedAt = r.CreatedAt
                    }).ToList()
            };

            return Results.Ok(dto);
        });

        // Public: submit a review for a game (no auth)
        group.MapPost("/{id:guid}/reviews", async (Guid id, PublicReviewRequest request, MoxicDbContext dbContext) =>
        {
            var gameExists = await dbContext.Games.AnyAsync(g => g.Id == id);
            if (!gameExists) return Results.NotFound();

            if (request.Rating < 1 || request.Rating > 5)
                return Results.BadRequest(new { error = "Điểm đánh giá phải từ 1 đến 5." });

            if (string.IsNullOrWhiteSpace(request.Content))
                return Results.BadRequest(new { error = "Nội dung đánh giá không được để trống." });

            if (request.Content.Length > 500)
                return Results.BadRequest(new { error = "Nội dung đánh giá không được vượt quá 500 ký tự." });

            var displayName = request.DisplayName;
            if (string.IsNullOrWhiteSpace(displayName))
            {
                var random = new Random();
                displayName = $"Ẩn danh {random.Next(1000, 9999)}";
            }
            else
            {
                displayName = displayName.Trim();
                if (displayName.Length > 50)
                    displayName = displayName[..50];
            }

            var review = new GameReview
            {
                Id = Guid.NewGuid(),
                GameId = id,
                UserName = displayName,
                AvatarUrl = $"https://i.pravatar.cc/40?u=review-{Guid.NewGuid()}",
                Rating = request.Rating,
                Content = request.Content.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.GameReviews.Add(review);
            await dbContext.SaveChangesAsync();

            return Results.Created($"/api/games/{id}/reviews", new GameReviewDto
            {
                Id = review.Id,
                UserName = review.UserName,
                AvatarUrl = review.AvatarUrl,
                Rating = review.Rating,
                Content = review.Content,
                CreatedAt = review.CreatedAt
            });
        });
    }
}

public record PublicReviewRequest(string? DisplayName, int Rating, string Content);
