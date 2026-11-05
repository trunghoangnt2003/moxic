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
    private const int RenderWidth = 720;
    private const long MaxDecodePixels = 40_000_000;
    private static readonly TimeSpan ImageCacheTtl = TimeSpan.FromHours(1);
    private static readonly SemaphoreSlim RenderGate = new(1, 1);

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;
    private readonly IDataProtector _protector;
    private readonly PointsService _points;
    private readonly ILogger<GuessGameService> _logger;
    private readonly IServiceScopeFactory _scopes;

    public GuessGameService(MoxicDbContext db, IMinioService minio, IHttpClientFactory http, IMemoryCache cache,
        IDataProtectionProvider dp, PointsService points, ILogger<GuessGameService> logger, IServiceScopeFactory scopes)
    {
        _scopes = scopes;
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
            PrerenderInBackground(today);
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


    /// <summary>
    /// Pixelated JPEG for a level (PixelSizes.Length = clear). A miss renders and stores every level from one decode;
    /// failures are never cached so the next request (or the web's retry) tries again. One render at a time.
    /// </summary>
    public async Task<byte[]?> ImageAsync(string date, int level)
    {
        level = Math.Clamp(level, 0, ClearLevel);
        var key = $"guess-img:{date}:{level}";
        if (_cache.TryGetValue(key, out byte[]? hit) && hit != null) return hit;

        await RenderGate.WaitAsync();
        try
        {
            if (_cache.TryGetValue(key, out hit) && hit != null) return hit;

            // Rendered once per day and stored — survives restarts. Postgres keeps them, so RAM only holds the busy hour.
            var stored = await _db.GuessImages.AsNoTracking().Where(x => x.Date == date && x.Level == level).Select(x => x.Data).FirstOrDefaultAsync();
            if (stored != null)
            {
                _cache.Set(key, stored, ImageCacheTtl);
                return stored;
            }

            var src = await SourceAsync(date);
            if (src == null) return null;
            var rendered = RenderAll(src);
            if (rendered == null) return null;

            var existing = await _db.GuessImages.AsNoTracking().Where(x => x.Date == date).Select(x => x.Level).ToListAsync();
            for (var i = 0; i < rendered.Length; i++)
            {
                if (rendered[i] is { } data && !existing.Contains(i))
                    _db.GuessImages.Add(new GuessImage { Date = date, Level = i, Data = data, CreatedAt = DateTime.UtcNow });
            }
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { _db.ChangeTracker.Clear(); } // saved concurrently elsewhere — fine

            var bytes = rendered[level];
            if (bytes != null) _cache.Set(key, bytes, ImageCacheTtl);
            return bytes;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Guess image render failed for {Date} level {Level}", date, level);
            return null;
        }
        finally
        {
            RenderGate.Release();
        }
    }

    /// <summary>Index of the un-pixelated picture (shown after the game is over).</summary>
    public static int ClearLevel => PixelSizes.Length;

    /// <summary>Renders every level of a new puzzle right away and drops pictures older than a week.</summary>
    private void PrerenderInBackground(string date) =>
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<GuessGameService>();
                await svc.ImageAsync(date, 0); // a miss renders and stores every level
                var cutoff = (DateTime.UtcNow + Vn).AddDays(-7).ToString("yyyy-MM-dd");
                var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
                await db.GuessImages.Where(x => string.Compare(x.Date, cutoff) < 0).ExecuteDeleteAsync();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Guess prerender failed for {Date}", date); }
        });

    /// <summary>Original picture bytes for a day (fetched with retries; only needed while rendering, so never cached).</summary>
    private async Task<byte[]?> SourceAsync(string date)
    {
        var p = await _db.GuessPuzzles.AsNoTracking().FirstOrDefaultAsync(x => x.Date == date);
        if (p == null) return null;
        var client = _http.CreateClient(PriceTrackerService.HttpClientName);
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                var url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, p.ObjectKey);
                var bytes = await client.GetByteArrayAsync(url);
                if (bytes.Length > 0) return bytes;
            }
            catch (Exception ex) when (attempt < 3)
            {
                _logger.LogWarning(ex, "Guess source fetch attempt {Attempt} failed for {Date}", attempt, date);
                await Task.Delay(400 * attempt);
            }
        }
        return null;
    }

    /// <summary>Every level from a single decode, indexed by level; null if the picture can't be decoded.</summary>
    private static byte[]?[]? RenderAll(byte[] src)
    {
        using var sized = DecodeSized(src);
        if (sized == null) return null;
        var levels = new byte[]?[ClearLevel + 1];
        for (var level = 0; level <= ClearLevel; level++) levels[level] = Render(sized, level);
        return levels;
    }

    /// <summary>
    /// Decodes at (or close to) 720px wide, resized to exactly that. Pixel buffers are native memory outside the GC
    /// heap limit, so formats that can decode scaled never hold the full-size picture, and oversized ones are refused.
    /// </summary>
    private static SKBitmap? DecodeSized(byte[] src)
    {
        using var encoded = SKData.CreateCopy(src);
        using var codec = SKCodec.Create(encoded);
        if (codec == null) return null;
        var dim = codec.GetScaledDimensions(Math.Min(1f, RenderWidth / (float)codec.Info.Width));
        if ((long)dim.Width * dim.Height > MaxDecodePixels) return null;

        using var decoded = new SKBitmap(new SKImageInfo(dim.Width, dim.Height));
        var result = codec.GetPixels(decoded.Info, decoded.GetPixels());
        if (result != SKCodecResult.Success && result != SKCodecResult.IncompleteInput) return null;

        var w = Math.Min(RenderWidth, dim.Width);
        var h = Math.Max(1, (int)Math.Round(dim.Height * (w / (double)dim.Width)));
        return decoded.Resize(new SKImageInfo(w, h), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear)) ?? decoded.Copy();
    }

    /// <summary>Pixelate (and blur the first two levels) unless it is the clear level.</summary>
    private static byte[]? Render(SKBitmap sized, int level)
    {
        var w = sized.Width;
        var h = sized.Height;
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
