using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;
using SkiaSharp;

namespace Moxic.Api.Services;

/// <summary>
/// "Đoán game" — a daily guess-the-game puzzle. The puzzle is picked automatically on the first request of
/// each Vietnam day; the picture is pixelated server-side so players only ever receive the level they unlocked.
/// </summary>
public class GuessGameService
{
    public const int MaxTries = 6;
    /// <summary>Pixel block size per unlocked level (0 = first look); the final level is the clear image.</summary>
    private static readonly int[] PixelSizes = [56, 38, 26, 17, 10, 6];
    private static readonly int[] PointsByTry = [100, 70, 50, 35, 20, 10];
    public const int StreakBonusPerDay = 5;
    public const int StreakBonusCap = 50;
    private const int NoRepeatDays = 60;
    private static readonly TimeSpan Vn = TimeSpan.FromHours(7);

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;
    private readonly IDataProtector _protector;
    private readonly PointsService _points;
    private readonly ILogger<GuessGameService> _logger;

    public GuessGameService(MoxicDbContext db, IMinioService minio, IHttpClientFactory http, IMemoryCache cache,
        IDataProtectionProvider dp, PointsService points, ILogger<GuessGameService> logger)
    {
        _db = db;
        _minio = minio;
        _http = http;
        _cache = cache;
        _protector = dp.CreateProtector("guess-image");
        _points = points;
        _logger = logger;
    }

    public static string Today() => (DateTime.UtcNow + Vn).ToString("yyyy-MM-dd");
    public static DateTime NextDayUtc()
    {
        var local = DateTime.UtcNow + Vn;
        return DateTime.SpecifyKind(local.Date.AddDays(1), DateTimeKind.Utc) - Vn;
    }

    public static string PlayerKeyFor(string? userId, string? guestKey) =>
        userId != null ? $"u:{userId}"
        : "g:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(guestKey ?? ""))).ToLowerInvariant()[..40];

    /// <summary>Today's puzzle, created on demand (race-safe via the Date primary key).</summary>
    public async Task<GuessPuzzle?> TodayPuzzleAsync()
    {
        var today = Today();
        var p = await _db.GuessPuzzles.AsNoTracking().FirstOrDefaultAsync(x => x.Date == today);
        if (p != null) return p;

        var since = (DateTime.UtcNow + Vn).AddDays(-NoRepeatDays).ToString("yyyy-MM-dd");
        var recent = await _db.GuessPuzzles.AsNoTracking().Where(x => string.Compare(x.Date, since) >= 0).Select(x => x.GameId).ToListAsync();

        // Real games with at least one picture (not videos), prefer ones not used recently.
        var candidates = await _db.Games.AsNoTracking()
            .Where(g => g.ProductType == "Game" && _db.GameMedias.Any(m => m.GameId == g.Id && !m.ObjectKey.EndsWith(".mp4") && !m.ObjectKey.EndsWith(".webm")))
            .Select(g => g.Id).ToListAsync();
        if (candidates.Count == 0) return null;
        var pool = candidates.Except(recent).ToList();
        if (pool.Count == 0) pool = candidates;
        var gameId = pool[RandomNumberGenerator.GetInt32(pool.Count)];

        // Screenshots first (covers usually print the title), then the cover.
        var media = await _db.GameMedias.AsNoTracking()
            .Where(m => m.GameId == gameId && !m.ObjectKey.EndsWith(".mp4") && !m.ObjectKey.EndsWith(".webm"))
            .OrderBy(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
            .Select(m => m.ObjectKey).ToListAsync();
        var key = media.Count > 1 ? media[RandomNumberGenerator.GetInt32(Math.Min(media.Count - 1, 4))] : media[0];

        var puzzle = new GuessPuzzle { Date = today, GameId = gameId, ObjectKey = key, CreatedAt = DateTime.UtcNow };
        _db.GuessPuzzles.Add(puzzle);
        try
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Guess puzzle {Date}: game {Game}", today, gameId);
            return puzzle;
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            return await _db.GuessPuzzles.AsNoTracking().FirstOrDefaultAsync(x => x.Date == today);
        }
    }

    public Task<int> NumberAsync(string date) => _db.GuessPuzzles.CountAsync(x => string.Compare(x.Date, date) <= 0);

    public string ImageToken(string date, int level) =>
        _protector.ToTimeLimitedDataProtector().Protect($"{date}|{level}", TimeSpan.FromDays(2));

    public (string Date, int Level)? ReadToken(string token)
    {
        try
        {
            var parts = _protector.ToTimeLimitedDataProtector().Unprotect(token).Split('|');
            return (parts[0], int.Parse(parts[1]));
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Pixelated JPEG for a level (PixelSizes.Length = clear). Cached per (date, level).</summary>
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> RenderLocks = new();

    /// <summary>
    /// Pixelated JPEG for a level (PixelSizes.Length = clear). Successful renders are cached per (date, level);
    /// failures are never cached so the next request (or the web's retry) tries again. One render per key at a time.
    /// </summary>
    public async Task<byte[]?> ImageAsync(string date, int level)
    {
        var key = $"guess-img:{date}:{level}";
        if (_cache.TryGetValue(key, out byte[]? hit) && hit != null) return hit;

        var gate = RenderLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            if (_cache.TryGetValue(key, out hit) && hit != null) return hit;
            var src = await SourceAsync(date);
            if (src == null) return null;
            var bytes = Render(src, level);
            if (bytes != null) _cache.Set(key, bytes, TimeSpan.FromHours(30));
            return bytes;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Guess image render failed for {Date} level {Level}", date, level);
            return null;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Original picture bytes for a day (cached; fetched with retries).</summary>
    private async Task<byte[]?> SourceAsync(string date)
    {
        var key = $"guess-src:{date}";
        if (_cache.TryGetValue(key, out byte[]? cached) && cached != null) return cached;
        var p = await _db.GuessPuzzles.AsNoTracking().FirstOrDefaultAsync(x => x.Date == date);
        if (p == null) return null;
        var client = _http.CreateClient(PriceTrackerService.HttpClientName);
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                var url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, p.ObjectKey);
                var bytes = await client.GetByteArrayAsync(url);
                if (bytes.Length > 0)
                {
                    _cache.Set(key, bytes, TimeSpan.FromHours(30));
                    return bytes;
                }
            }
            catch (Exception ex) when (attempt < 3)
            {
                _logger.LogWarning(ex, "Guess source fetch attempt {Attempt} failed for {Date}", attempt, date);
                await Task.Delay(400 * attempt);
            }
        }
        return null;
    }

    /// <summary>Resize to 720px wide; pixelate (and blur the first two levels) unless it is the clear level.</summary>
    private static byte[]? Render(byte[] src, int level)
    {
        using var original = SKBitmap.Decode(src);
        if (original == null) return null;
        var w = Math.Min(720, original.Width);
        var h = Math.Max(1, (int)Math.Round(original.Height * (w / (double)original.Width)));
        using var sized = original.Resize(new SKImageInfo(w, h), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear)) ?? original.Copy();
        SKBitmap output = sized;
        SKBitmap? temp = null;
        if (level < PixelSizes.Length)
        {
            var px = PixelSizes[level];
            using var tiny = sized.Resize(new SKImageInfo(Math.Max(1, w / px), Math.Max(1, h / px)), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
            temp = tiny.Resize(new SKImageInfo(w, h), new SKSamplingOptions(SKFilterMode.Nearest));
            output = temp;
            if (level <= 1)
            {
                var blurred = new SKBitmap(w, h);
                using var canvas = new SKCanvas(blurred);
                using var paint = new SKPaint { ImageFilter = SKImageFilter.CreateBlur(4, 4) };
                canvas.DrawBitmap(temp, 0, 0, paint);
                temp.Dispose();
                temp = blurred;
                output = blurred;
            }
        }
        using var image = SKImage.FromBitmap(output);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 82);
        var bytes = data.ToArray();
        temp?.Dispose();
        return bytes;
    }

    public async Task<GuessPlay?> PlayAsync(string date, string playerKey) =>
        await _db.GuessPlays.FirstOrDefaultAsync(x => x.Date == date && x.PlayerKey == playerKey);

    /// <summary>Consecutive solved days ending today (or yesterday if today isn't solved yet).</summary>
    public async Task<int> StreakAsync(string userId)
    {
        var dates = await _db.GuessPlays.AsNoTracking().Where(x => x.UserId == userId && x.Solved)
            .OrderByDescending(x => x.Date).Select(x => x.Date).Take(400).ToListAsync();
        var set = dates.ToHashSet();
        var day = (DateTime.UtcNow + Vn).Date;
        if (!set.Contains(day.ToString("yyyy-MM-dd"))) day = day.AddDays(-1);
        var streak = 0;
        while (set.Contains(day.ToString("yyyy-MM-dd")))
        {
            streak++;
            day = day.AddDays(-1);
        }
        return streak;
    }

    public record GuessResult(bool Ok, string? Error, bool Correct = false, int Points = 0);

    public async Task<GuessResult> GuessAsync(GuessPuzzle puzzle, string playerKey, string? userId, Guid gameId)
    {
        if (!await _db.Games.AnyAsync(g => g.Id == gameId)) return new(false, "Game không có trong kho");
        var play = await PlayAsync(puzzle.Date, playerKey);
        var now = DateTime.UtcNow;
        if (play == null)
        {
            play = new GuessPlay { Id = Guid.NewGuid(), Date = puzzle.Date, PlayerKey = playerKey, UserId = userId, CreatedAt = now };
            _db.GuessPlays.Add(play);
        }
        if (play.Finished) return new(false, "Bạn đã chơi xong hôm nay — quay lại ngày mai nhé!");
        var guessed = play.Guesses.Length == 0 ? new List<string>() : play.Guesses.Split(',').ToList();
        if (guessed.Contains(gameId.ToString("N"))) return new(false, "Bạn đã đoán game này rồi");

        guessed.Add(gameId.ToString("N"));
        play.Guesses = string.Join(',', guessed);
        play.Tries = guessed.Count;
        play.UpdatedAt = now;
        var correct = gameId == puzzle.GameId;
        if (correct) play.Solved = true;
        if (correct || play.Tries >= MaxTries) play.Finished = true;

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            return new(false, "Thử lại nhé");
        }

        var points = 0;
        if (correct && userId != null)
        {
            var streak = await StreakAsync(userId); // includes today now
            points = PointsByTry[play.Tries - 1] + Math.Min(streak * StreakBonusPerDay, StreakBonusCap);
            var credited = await _points.CreditOnceAsync(userId, points, PointsReason.DailyGuess, $"guess:{puzzle.Date}:{userId}",
                $"Đoán đúng game #{puzzle.Date} sau {play.Tries} lần");
            if (credited == null) points = 0;
            else
            {
                play.Points = points;
                await _db.SaveChangesAsync();
            }
        }
        return new(true, null, correct, points);
    }

    public static int PointsFor(int tries) => tries >= 1 && tries <= MaxTries ? PointsByTry[tries - 1] : 0;
}
