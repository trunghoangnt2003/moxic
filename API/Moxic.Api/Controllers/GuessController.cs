using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record GuessRequest(Guid GameId);

/// <summary>Daily "Đoán game" puzzle. Signed-in customers earn points and streaks; guests play by browser key (X-Guess-Key).</summary>
[ApiController]
[Route("api/guess")]
public class GuessController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly GuessGameService _guess;
    private readonly IMemoryCache _cache;

    public GuessController(MoxicDbContext db, GuessGameService guess, IMemoryCache cache)
    {
        _db = db;
        _guess = guess;
        _cache = cache;
    }

    private async Task<string?> CustomerIdAsync()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        return auth.Succeeded && auth.Principal?.IsInRole(CustomerAuthRules.CustomerRole) == true
            ? auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
    }

    private string? GuestKey()
    {
        var k = Request.Headers["X-Guess-Key"].FirstOrDefault();
        return k is { Length: >= 16 and <= 100 } ? k : null;
    }

    // GET /api/guess/options — every game name for the autocomplete (cached 10 min)
    [HttpGet("options")]
    public async Task<IActionResult> Options()
    {
        var list = await _cache.GetOrCreateAsync("guess-options", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return await _db.Games.AsNoTracking().Where(g => g.ProductType == "Game")
                .OrderBy(g => g.Name).Select(g => new { g.Id, g.Name }).ToListAsync();
        });
        Response.Headers.CacheControl = "public, max-age=600";
        return Ok(list);
    }

    private async Task<object> StateAsync(Moxic.Core.Entities.GuessPuzzle p, string? userId, string playerKey)
    {
        var play = await _guess.PlayAsync(p.Date, playerKey);
        var guessedIds = play == null || play.Guesses.Length == 0 ? new List<Guid>() : play.Guesses.Split(',').Select(Guid.Parse).ToList();
        var names = await _db.Games.AsNoTracking().Where(g => guessedIds.Contains(g.Id)).ToDictionaryAsync(g => g.Id, g => g.Name);
        var tries = play?.Tries ?? 0;
        var finished = play?.Finished ?? false;
        var level = finished ? 99 : Math.Min(tries, GuessGameService.MaxTries - 1);

        var game = await _db.Games.AsNoTracking().Where(g => g.Id == p.GameId)
            .Select(g => new { g.Id, g.Name, g.ReleaseDate, g.Publisher, g.SalePrice, g.OriginalPrice, Genres = g.Genres.Select(x => x.Name).ToList() })
            .FirstAsync();

        // Hints unlock with wrong guesses.
        var hints = new List<object>();
        if (tries >= 2 || finished) hints.Add(new { label = RequestLanguage.T("Thể loại", "Genre"), value = game.Genres.Count > 0 ? string.Join(", ", game.Genres.Take(2)) : "—" });
        if (tries >= 3 || finished) hints.Add(new { label = RequestLanguage.T("Năm phát hành", "Release year"), value = game.ReleaseDate?.AddHours(7).Year.ToString() ?? "—" });
        if (tries >= 4 || finished) hints.Add(new { label = RequestLanguage.T("Nhà phát hành", "Publisher"), value = game.Publisher ?? "—" });
        if (tries >= 5 || finished) hints.Add(new { label = RequestLanguage.T("Chữ cái đầu", "First letter"), value = RequestLanguage.T($"{char.ToUpperInvariant(game.Name.Trim()[0])}… ({game.Name.Length} ký tự)", $"{char.ToUpperInvariant(game.Name.Trim()[0])}… ({game.Name.Length} characters)") });

        var stats = await _cache.GetOrCreateAsync($"guess-stats:{p.Date}", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            var rows = await _db.GuessPlays.AsNoTracking().Where(x => x.Date == p.Date && x.Finished)
                .GroupBy(x => x.Solved ? x.Tries : 0).Select(g => new { g.Key, N = g.Count() }).ToListAsync();
            return new
            {
                players = rows.Sum(r => r.N),
                solved = rows.Where(r => r.Key > 0).Sum(r => r.N),
                distribution = Enumerable.Range(1, GuessGameService.MaxTries).Select(t => rows.FirstOrDefault(r => r.Key == t)?.N ?? 0).ToList(),
            };
        });

        return new
        {
            date = p.Date,
            number = await _guess.NumberAsync(p.Date),
            maxTries = GuessGameService.MaxTries,
            nextAt = GuessGameService.NextDayUtc(),
            // Relative to the API base ("…/api"): the web app prefixes it.
            imagePath = "guess/image?t=" + Uri.EscapeDataString(_guess.ImageToken(p.Date, level)),
            tries,
            solved = play?.Solved ?? false,
            finished,
            points = play?.Points ?? 0,
            nextPoints = GuessGameService.PointsFor(tries + 1),
            guesses = guessedIds.Select(id => new { id, name = names.GetValueOrDefault(id, "?"), correct = id == p.GameId }),
            hints,
            streak = userId != null ? await _guess.StreakAsync(userId) : 0,
            signedIn = userId != null,
            answer = finished ? new { game.Id, game.Name, game.SalePrice, game.OriginalPrice } : null,
            stats,
        };
    }

    // GET /api/guess/today
    [HttpGet("today")]
    public async Task<IActionResult> Today()
    {
        var p = await _guess.TodayPuzzleAsync();
        if (p == null) return NotFound(new { error = "Chưa có câu đố hôm nay" });
        var userId = await CustomerIdAsync();
        var guest = GuestKey();
        if (userId == null && guest == null) return BadRequest(new { error = "Thiếu X-Guess-Key" });
        return Ok(await StateAsync(p, userId, GuessGameService.PlayerKeyFor(userId, guest)));
    }

    // POST /api/guess/today
    [HttpPost("today")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Guess([FromBody] GuessRequest req)
    {
        var p = await _guess.TodayPuzzleAsync();
        if (p == null) return NotFound(new { error = "Chưa có câu đố hôm nay" });
        var userId = await CustomerIdAsync();
        var guest = GuestKey();
        if (userId == null && guest == null) return BadRequest(new { error = "Thiếu X-Guess-Key" });
        var key = GuessGameService.PlayerKeyFor(userId, guest);
        var r = await _guess.GuessAsync(p, key, userId, req.GameId);
        if (!r.Ok) return BadRequest(new { error = r.Error });
        _cache.Remove($"guess-stats:{p.Date}");
        return Ok(new { correct = r.Correct, earned = r.Points, state = await StateAsync(p, userId, key) });
    }

    // GET /api/guess/image?t=TOKEN — pixelated picture for exactly the level the token grants
    [HttpGet("image")]
    public async Task<IActionResult> Image([FromQuery] string t)
    {
        var tok = _guess.ReadToken(t ?? "");
        if (tok == null) return NotFound();
        var bytes = await _guess.ImageAsync(tok.Value.Date, tok.Value.Level);
        if (bytes == null)
        {
            // Temporary (source fetch/render failed): never let the browser or CDN cache the failure.
            Response.Headers.CacheControl = "no-store";
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        Response.Headers.CacheControl = "private, max-age=86400";
        return File(bytes, "image/jpeg");
    }
}
