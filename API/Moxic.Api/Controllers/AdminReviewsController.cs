using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

[Route("api/admin/games/{gameId:guid}/reviews")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminReviewsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminReviewsController(MoxicDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetReviews(Guid gameId)
    {
        var gameExists = await _db.Games.AnyAsync(g => g.Id == gameId);
        if (!gameExists) return NotFound();

        var reviews = await _db.GameReviews
            .Where(r => r.GameId == gameId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(reviews.Select(r => new
        {
            r.Id,
            r.UserName,
            r.AvatarUrl,
            r.Rating,
            r.Content,
            r.CreatedAt
        }));
    }

    [HttpPost]
    public async Task<IActionResult> CreateReview(Guid gameId, [FromBody] CreateReviewRequest request)
    {
        var gameExists = await _db.Games.AnyAsync(g => g.Id == gameId);
        if (!gameExists) return NotFound();

        var review = new GameReview
        {
            Id = Guid.NewGuid(),
            GameId = gameId,
            UserName = request.UserName,
            AvatarUrl = $"https://i.pravatar.cc/40?u=review-{Guid.NewGuid()}",
            Rating = request.Rating,
            Content = request.Content,
            CreatedAt = DateTime.UtcNow
        };

        _db.GameReviews.Add(review);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetReviews), new { gameId }, new
        {
            review.Id,
            review.UserName,
            review.AvatarUrl,
            review.Rating,
            review.Content,
            review.CreatedAt
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteReview(Guid gameId, Guid id)
    {
        var review = await _db.GameReviews.FirstOrDefaultAsync(r => r.Id == id && r.GameId == gameId);
        if (review == null) return NotFound();

        _db.GameReviews.Remove(review);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

public record CreateReviewRequest(string UserName, int Rating, string Content);
