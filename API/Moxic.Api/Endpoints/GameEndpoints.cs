using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.DTOs;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Endpoints;

public static class GameEndpoints
{
    public static void MapGameEndpoints(this IEndpointRouteBuilder app)
    {
        // GETs are output-cached for 60s (policy "catalog"); writes evict the "games" tag.
        var group = app.MapGroup("/api/games").WithTags("Games").CacheOutput("catalog");

        group.MapGet("/", async (
            MoxicDbContext dbContext,
            IMinioService minioService,
            string? q,
            string? status,
            string? genres,
            string? tags,
            string? ids,
            string? type,
            string? region,
            string? publisher,
            decimal? minPrice,
            decimal? maxPrice,
            bool? onSale,
            bool? rentable,
            bool? flashSale,
            int? yearFrom,
            int? yearTo,
            double? minRating,
            string? sort,
            int page = 1,
            int pageSize = 20) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 60);

            var query = dbContext.Games.AsNoTracking();

            var term = q?.Trim();
            if (!string.IsNullOrEmpty(term))
            {
                var pattern = $"%{EscapeLike(term)}%";
                query = query.Where(g => EF.Functions.ILike(g.Name, pattern, "\\")
                    || (g.NameEn != null && EF.Functions.ILike(g.NameEn, pattern, "\\"))
                    || g.Tags.Any(t => EF.Functions.ILike(t.Name, pattern, "\\"))
                    || g.Genres.Any(x => EF.Functions.ILike(x.Name, pattern, "\\")));
            }

            if (Enum.TryParse<Moxic.Shared.Enums.GameStatus>(status, true, out var parsedStatus))
                query = query.Where(g => g.Status == parsedStatus);

            var genreIds = ParseIds(genres);
            if (genreIds.Count > 0)
                query = query.Where(g => g.Genres.Any(x => genreIds.Contains(x.Id)));

            var tagIds = ParseIds(tags);
            if (tagIds.Count > 0)
                query = query.Where(g => g.Tags.Any(t => tagIds.Contains(t.Id)));

            var types = ParseList(type);
            if (types.Count > 0) query = query.Where(g => types.Contains(g.ProductType));
            var regions = ParseList(region);
            if (regions.Count > 0) query = query.Where(g => g.Region != null && regions.Contains(g.Region));
            var publishers = ParseList(publisher);
            if (publishers.Count > 0) query = query.Where(g => g.Publisher != null && publishers.Contains(g.Publisher));

            if (yearFrom.HasValue)
            {
                var from = new DateTime(Math.Clamp(yearFrom.Value, 1970, 2100), 1, 1, 0, 0, 0, DateTimeKind.Utc);
                query = query.Where(g => g.ReleaseDate != null && g.ReleaseDate >= from);
            }
            if (yearTo.HasValue)
            {
                var to = new DateTime(Math.Clamp(yearTo.Value, 1970, 2100) + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                query = query.Where(g => g.ReleaseDate != null && g.ReleaseDate < to);
            }
            if (minRating.HasValue)
            {
                var min = Math.Clamp(minRating.Value, 1, 5);
                query = query.Where(g => g.Reviews.Any(r => !r.IsHidden) && g.Reviews.Where(r => !r.IsHidden).Average(r => r.Rating) >= min);
            }

            var idList = ParseIds(ids);
            if (idList.Count > 0)
                query = query.Where(g => idList.Contains(g.Id));

            if (minPrice.HasValue) query = query.Where(g => g.SalePrice >= minPrice.Value);
            if (maxPrice.HasValue) query = query.Where(g => g.SalePrice <= maxPrice.Value);
            if (onSale == true) query = query.Where(g => g.SalePrice < g.OriginalPrice);
            if (flashSale == true)
            {
                var nowUtc = DateTime.UtcNow;
                query = query.Where(g => g.SaleEndsAt != null && g.SaleEndsAt > nowUtc && g.SalePrice < g.OriginalPrice);
            }
            if (rentable == true)
                query = query.Where(g => dbContext.RentalPlans.Any(p => p.GameId == g.Id && p.IsActive)
                                         && dbContext.RentalAssets.Any(a => a.IsActive && a.Games.Any(x => x.GameId == g.Id)));

            query = sort switch
            {
                "name-asc" => query.OrderBy(g => g.Name),
                "name-desc" => query.OrderByDescending(g => g.Name),
                "price-asc" => query.OrderBy(g => g.SalePrice).ThenBy(g => g.Name),
                "price-desc" => query.OrderByDescending(g => g.SalePrice).ThenBy(g => g.Name),
                "discount" => query
                    .OrderByDescending(g => g.OriginalPrice > 0 ? (g.OriginalPrice - g.SalePrice) / g.OriginalPrice : 0)
                    .ThenBy(g => g.Name),
                "ending" => query.OrderBy(g => g.SaleEndsAt == null).ThenBy(g => g.SaleEndsAt).ThenBy(g => g.Name),
                "bestseller" => query
                    .OrderByDescending(g => dbContext.OrderDetails.Count(d => d.GameId == g.Id && SoldStatuses.Contains(d.Order.Status)))
                    .ThenByDescending(g => g.IsFeatured).ThenBy(g => g.Name),
                "release" => query.OrderBy(g => g.ReleaseDate == null).ThenByDescending(g => g.ReleaseDate).ThenBy(g => g.Name),
                _ => query.OrderByDescending(g => g.IsFeatured).ThenByDescending(g => g.CreatedAt),
            };

            var total = await query.CountAsync();
            var items = await query
                .Include(g => g.Media)
                .Include(g => g.Genres)
                .Include(g => g.Tags)
                .AsSplitQuery()
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var pageIds = items.Select(g => g.Id).ToList();
            var sold = await LoadSoldCountsAsync(dbContext, pageIds);
            var editionCounts = await dbContext.GameEditions.AsNoTracking()
                .Where(e => pageIds.Contains(e.GameId) && e.IsActive)
                .GroupBy(e => e.GameId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
            var rentFrom = await dbContext.RentalPlans.AsNoTracking()
                .Where(p => pageIds.Contains(p.GameId) && p.IsActive
                            && dbContext.RentalAssets.Any(a => a.IsActive && a.Games.Any(x => x.GameId == p.GameId)))
                .GroupBy(p => p.GameId)
                .Select(g => new { g.Key, Min = g.Min(p => p.Price) })
                .ToDictionaryAsync(x => x.Key, x => x.Min);
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
                    Name = RequestLanguage.Pick(game.Name, game.NameEn),
                    OriginalPrice = game.OriginalPrice,
                    SalePrice = game.SalePrice,
                    Genres = game.Genres.Select(g => new GenreDto(g.Id, g.Name)).ToList(),
                    Tags = game.Tags.Select(t => new TagDto(t.Id, t.Name)).ToList(),
                    Status = game.Status.ToString(),
                    ReleaseDate = game.ReleaseDate,
                    CoverImageUrl = coverUrl,
                    SoldCount = sold.GetValueOrDefault(game.Id),
                    ProductType = game.ProductType,
                    Region = game.Region,
                    Publisher = game.Publisher,
                    EditionCount = editionCounts.GetValueOrDefault(game.Id),
                    RentFrom = rentFrom.TryGetValue(game.Id, out var rf) ? rf : null,
                    SaleEndsAt = game.SaleEndsAt > DateTime.UtcNow && game.SalePrice < game.OriginalPrice ? game.SaleEndsAt : null
                });
            }

            return Results.Ok(new { items = dtos, total, page, pageSize });
        });

        // Filter options for the store page: only genres/tags that are actually used, with counts.
        group.MapGet("/facets", async (MoxicDbContext dbContext) =>
        {
            var genreFacets = await dbContext.Games.AsNoTracking()
                .SelectMany(g => g.Genres)
                .GroupBy(x => new { x.Id, x.Name })
                .Select(grp => new { id = grp.Key.Id, name = grp.Key.Name, count = grp.Count() })
                .OrderByDescending(x => x.count).ThenBy(x => x.name)
                .ToListAsync();

            var tagFacets = await dbContext.Games.AsNoTracking()
                .SelectMany(g => g.Tags)
                .GroupBy(x => new { x.Id, x.Name })
                .Select(grp => new { id = grp.Key.Id, name = grp.Key.Name, count = grp.Count() })
                .OrderByDescending(x => x.count).ThenBy(x => x.name)
                .ToListAsync();

            var games = dbContext.Games.AsNoTracking();
            var hasGames = await games.AnyAsync();
            var minPrice = hasGames ? await games.MinAsync(g => g.SalePrice) : 0;
            var maxPrice = hasGames ? await games.MaxAsync(g => g.SalePrice) : 0;
            var available = await games.CountAsync(g => g.Status == Moxic.Shared.Enums.GameStatus.Available);
            var preorder = await games.CountAsync(g => g.Status == Moxic.Shared.Enums.GameStatus.Preorder);
            var onSale = await games.CountAsync(g => g.SalePrice < g.OriginalPrice);

            var typeFacets = await games
                .GroupBy(g => g.ProductType)
                .Select(grp => new { id = grp.Key, name = grp.Key, count = grp.Count() })
                .OrderByDescending(x => x.count).ToListAsync();
            var regionFacets = await games.Where(g => g.Region != null && g.Region != "")
                .GroupBy(g => g.Region!)
                .Select(grp => new { id = grp.Key, name = grp.Key, count = grp.Count() })
                .OrderByDescending(x => x.count).ToListAsync();
            var publisherFacets = await games.Where(g => g.Publisher != null && g.Publisher != "")
                .GroupBy(g => g.Publisher!)
                .Select(grp => new { id = grp.Key, name = grp.Key, count = grp.Count() })
                .OrderByDescending(x => x.count).ThenBy(x => x.name).ToListAsync();

            var years = await games.Where(g => g.ReleaseDate != null).Select(g => g.ReleaseDate!.Value.Year).Distinct().OrderByDescending(y => y).ToListAsync();

            return Results.Ok(new
            {
                years,
                genres = genreFacets,
                tags = tagFacets,
                types = typeFacets,
                regions = regionFacets,
                publishers = publisherFacets,
                price = new { min = minPrice, max = maxPrice },
                status = new { available, preorder },
                onSale
            });
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
                    Name = RequestLanguage.Pick(game.Name, game.NameEn),
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

        group.MapGet("/{id:guid}", async (Guid id, MoxicDbContext dbContext, IMinioService minioService, Moxic.Api.Services.LeaderboardService leaderboard) =>
        {
            var game = await dbContext.Games.AsNoTracking()
                .Include(g => g.Media)
                .Include(g => g.Genres)
                .Include(g => g.Tags)
                .Include(g => g.Reviews)
                .Include(g => g.Editions)
                .AsSplitQuery()
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
                .CountAsync(od => od.GameId == id && SoldStatuses.Contains(od.Order.Status));

            var visibleReviews = game.Reviews.Where(r => !r.IsHidden).ToList();
            var storeRating = visibleReviews.Count > 0
                ? Math.Round(visibleReviews.Average(r => r.Rating), 1)
                : 5.0;

            var dto = new GameDetailDto
            {
                Id = game.Id,
                Name = RequestLanguage.Pick(game.Name, game.NameEn),
                Description = RequestLanguage.Pick(game.Description, game.DescriptionEn),
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
                ProductType = game.ProductType,
                Region = game.Region,
                Publisher = game.Publisher,
                Developer = game.Developer,
                XboxProductId = game.XboxProductId,
                SaleEndsAt = game.SaleEndsAt > DateTime.UtcNow && game.SalePrice < game.OriginalPrice ? game.SaleEndsAt : null,
                Editions = game.Editions
                    .Where(e => e.IsActive)
                    .OrderBy(e => e.DisplayOrder).ThenBy(e => e.SalePrice)
                    .Select(e => new GameEditionDto
                    {
                        Id = e.Id,
                        Name = e.Name,
                        Includes = (e.Includes ?? string.Empty)
                            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
                        // Unpriced edition (0) sells at the game's price, same as checkout.
                        OriginalPrice = e.SalePrice > 0 ? e.OriginalPrice : game.OriginalPrice,
                        SalePrice = e.SalePrice > 0 ? e.SalePrice : game.SalePrice,
                        IsDefault = e.IsDefault
                    }).ToList(),
                Reviews = game.Reviews
                    .Where(r => !r.IsHidden)
                    .OrderByDescending(r => r.IsVerifiedPurchase)
                    .ThenByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                    .Take(12)
                    .Select(r => new GameReviewDto
                    {
                        Id = r.Id,
                        UserName = r.UserName,
                        AvatarUrl = r.AvatarUrl,
                        Rating = r.Rating,
                        Content = r.Content,
                        CreatedAt = r.CreatedAt,
                        IsVerifiedPurchase = r.IsVerifiedPurchase
                    }).ToList()
            };

            // Leaderboard badges next to review authors
            var authorOf = game.Reviews.Where(r => r.UserId != null).ToDictionary(r => r.Id, r => r.UserId!);
            var badges = await leaderboard.BadgesAsync(authorOf.Values);
            foreach (var rv in dto.Reviews)
                if (authorOf.TryGetValue(rv.Id, out var uid) && badges.TryGetValue(uid, out var b)) rv.Badges = b;

            return Results.Ok(dto);
        });

        // Public: submit a review. Signed-in customers get their account name, one review per game
        // (re-submitting updates it) and a "Đã mua" badge when they own the game.
        group.MapPost("/{id:guid}/reviews", async (Guid id, PublicReviewRequest request, MoxicDbContext dbContext, HttpContext http, Moxic.Api.Services.CommunityService community) =>
        {
            var gameExists = await dbContext.Games.AnyAsync(g => g.Id == id);
            if (!gameExists) return Results.NotFound();

            if (request.Rating < 1 || request.Rating > 5)
                return Results.BadRequest(new { error = "Điểm đánh giá phải từ 1 đến 5." });

            if (string.IsNullOrWhiteSpace(request.Content))
                return Results.BadRequest(new { error = "Nội dung đánh giá không được để trống." });

            if (request.Content.Length > 500)
                return Results.BadRequest(new { error = "Nội dung đánh giá không được vượt quá 500 ký tự." });

            var customer = await community.GetCustomerAsync(http);
            if (customer != null)
            {
                var verified = await community.HasPurchasedAsync(customer, id);
                var existing = await dbContext.GameReviews.FirstOrDefaultAsync(r => r.GameId == id && r.UserId == customer.UserId);
                var now = DateTime.UtcNow;
                if (existing == null)
                {
                    existing = new GameReview
                    {
                        Id = Guid.NewGuid(), GameId = id, UserId = customer.UserId, CreatedAt = now,
                        AvatarUrl = $"https://i.pravatar.cc/40?u={Uri.EscapeDataString(customer.UserId)}",
                    };
                    dbContext.GameReviews.Add(existing);
                }
                existing.UserName = customer.DisplayName.Length > 50 ? customer.DisplayName[..50] : customer.DisplayName;
                existing.Rating = request.Rating;
                existing.Content = request.Content.Trim();
                existing.IsVerifiedPurchase = verified;
                existing.UpdatedAt = now;
                await dbContext.SaveChangesAsync();
                return Results.Ok(new GameReviewDto
                {
                    Id = existing.Id, UserName = existing.UserName, AvatarUrl = existing.AvatarUrl, Rating = existing.Rating,
                    Content = existing.Content, CreatedAt = existing.CreatedAt, IsVerifiedPurchase = verified, IsMine = true,
                });
            }

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
        }).RequireRateLimiting(Moxic.Api.Services.CouponRules.RateLimitPolicy);
    }

    /// <summary>Orders that are paid or being fulfilled count as sold.</summary>
    private static readonly Moxic.Shared.Enums.OrderStatus[] SoldStatuses =
    {
        Moxic.Shared.Enums.OrderStatus.Verifying,
        Moxic.Shared.Enums.OrderStatus.Installing,
        Moxic.Shared.Enums.OrderStatus.ActionRequired,
        Moxic.Shared.Enums.OrderStatus.Completed,
    };

    private static async Task<Dictionary<Guid, int>> LoadSoldCountsAsync(MoxicDbContext db, List<Guid> gameIds)
    {
        if (gameIds.Count == 0) return new Dictionary<Guid, int>();
        return await db.OrderDetails.AsNoTracking()
            .Where(d => gameIds.Contains(d.GameId) && SoldStatuses.Contains(d.Order.Status))
            .GroupBy(d => d.GameId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
    }

    private static List<Guid> ParseIds(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<Guid>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => Guid.TryParse(s, out var id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .Distinct()
                .Take(30)
                .ToList();

    private static List<string> ParseList(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<string>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => s.Length <= 100).Distinct().Take(20).ToList();

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}

public record PublicReviewRequest(string? DisplayName, int Rating, string Content);
