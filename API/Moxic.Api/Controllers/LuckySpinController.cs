using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>Public lucky-spin endpoints. The outcome is decided here (CSPRNG); the client only animates.</summary>
[Route("api/lucky-spin")]
[ApiController]
public class LuckySpinController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public LuckySpinController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    // GET /api/lucky-spin/prizes — active prize pool (no probabilities exposed)
    [HttpGet("prizes")]
    public async Task<IActionResult> GetPrizes()
    {
        var prizes = await LoadActivePrizesAsync();
        var images = await ResolveImagesAsync(prizes);

        return Ok(new
        {
            available = LuckySpinRules.IsPoolValid(prizes),
            prizes = prizes.Select(p => ToPublic(p, images)).ToList()
        });
    }

    // POST /api/lucky-spin/spin — redeem one use of a code and draw a prize
    [HttpPost("spin")]
    [EnableRateLimiting(LuckySpinRules.RateLimitPolicy)]
    public async Task<IActionResult> Spin([FromBody] SpinRequest? request)
    {
        var code = LuckySpinRules.NormalizeCode(request?.Code);
        if (code == null)
            return BadRequest(new { error = "Mã quay không hợp lệ." });

        // Check the pool BEFORE consuming the code.
        var prizes = await LoadActivePrizesAsync();
        if (!LuckySpinRules.IsPoolValid(prizes))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "Vòng quay đang được cấu hình, vui lòng quay lại sau." });

        var now = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Atomic redemption: a single conditional UPDATE. PostgreSQL re-evaluates the
        // WHERE clause under the row lock, so concurrent requests cannot both succeed.
        var affected = await _db.SpinCodes
            .Where(c => c.Code == code
                        && c.IsActive
                        && c.UsedCount < c.MaxUses
                        && (c.ExpiresAt == null || c.ExpiresAt > now))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1));

        if (affected == 0)
        {
            await tx.RollbackAsync();
            var existing = await _db.SpinCodes.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
            string reason;
            if (existing == null) reason = "Mã quay không hợp lệ.";
            else if (!existing.IsActive) reason = "Mã quay đã bị vô hiệu hóa.";
            else if (existing.ExpiresAt != null && existing.ExpiresAt <= now) reason = "Mã quay đã hết hạn.";
            else reason = "Mã quay đã hết lượt sử dụng.";
            return BadRequest(new { error = reason });
        }

        var codeRow = await _db.SpinCodes.AsNoTracking()
            .Where(c => c.Code == code)
            .Select(c => new { c.Id, c.MaxUses, c.UsedCount })
            .FirstAsync();

        var winner = LuckySpinRules.PickPrize(prizes);

        string? rewardCode = null;
        if (winner.Type != SpinPrizeType.Luck)
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var candidate = LuckySpinRules.GenerateRewardCode();
                if (!await _db.SpinHistories.AnyAsync(h => h.RewardCode == candidate))
                {
                    rewardCode = candidate;
                    break;
                }
            }
            if (rewardCode == null)
            {
                await tx.RollbackAsync();
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { error = "Không thể quay lúc này, vui lòng thử lại." });
            }
        }

        var history = new SpinHistory
        {
            Id = Guid.NewGuid(),
            SpinCodeId = codeRow.Id,
            CodeText = code,
            PrizeId = winner.Id,
            PrizeName = winner.Name,
            PrizeType = winner.Type,
            GameId = winner.GameId,
            RewardCode = rewardCode,
            IsClaimed = false,
            ClientIp = LuckySpinRules.GetClientIp(HttpContext),
            CreatedAt = DateTime.UtcNow
        };
        _db.SpinHistories.Add(history);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        var images = await ResolveImagesAsync(prizes);
        var reel = LuckySpinRules.BuildReel(prizes, winner).Select(p => ToPublic(p, images)).ToList();

        return Ok(new
        {
            spinId = history.Id,
            prize = ToPublic(winner, images),
            rewardCode,
            remainingUses = Math.Max(0, codeRow.MaxUses - codeRow.UsedCount),
            winningIndex = LuckySpinRules.WinningIndex,
            reel
        });
    }

    private async Task<List<SpinPrize>> LoadActivePrizesAsync() =>
        await _db.SpinPrizes.AsNoTracking()
            .Include(p => p.Game).ThenInclude(g => g!.Media)
            .Where(p => p.IsActive)
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync();

    private async Task<Dictionary<Guid, string?>> ResolveImagesAsync(IEnumerable<SpinPrize> prizes)
    {
        var map = new Dictionary<Guid, string?>();
        foreach (var p in prizes)
        {
            if (map.ContainsKey(p.Id)) continue;
            map[p.Id] = await LuckySpinRules.ResolveImageUrlAsync(_minio, p);
        }
        return map;
    }

    private static PublicPrizeDto ToPublic(SpinPrize p, IReadOnlyDictionary<Guid, string?> images) =>
        new(p.Id, p.Name, p.Type, LuckySpinRules.RarityFor(p.Probability), p.GameId,
            images.TryGetValue(p.Id, out var url) ? url : null);
}

public record SpinRequest(string? Code);

public record PublicPrizeDto(Guid Id, string Name, SpinPrizeType Type, string Rarity, Guid? GameId, string? ImageUrl);
