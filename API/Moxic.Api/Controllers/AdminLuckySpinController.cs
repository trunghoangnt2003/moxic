using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

[Route("api/admin/lucky-spin")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminLuckySpinController : ControllerBase
{
    private const string DefaultLuckName = "Chúc bạn may mắn lần sau";

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public AdminLuckySpinController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    // ───────────────────────── Prizes ─────────────────────────

    [HttpGet("prizes")]
    public async Task<IActionResult> GetPrizes()
    {
        var prizes = await _db.SpinPrizes.AsNoTracking()
            .Include(p => p.Game).ThenInclude(g => g!.Media)
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync();

        var result = new List<AdminPrizeDto>();
        foreach (var p in prizes) result.Add(await ToAdminPrizeAsync(p));
        return Ok(result);
    }

    [HttpPost("prizes")]
    public async Task<IActionResult> CreatePrize([FromBody] PrizeUpsertRequest request)
    {
        var prize = new SpinPrize { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        var error = await ApplyPrizeAsync(prize, request, isNew: true);
        if (error != null) return BadRequest(new { error });

        _db.SpinPrizes.Add(prize);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPrizes), null, await LoadAdminPrizeAsync(prize.Id));
    }

    [HttpPut("prizes/{id:guid}")]
    public async Task<IActionResult> UpdatePrize(Guid id, [FromBody] PrizeUpsertRequest request)
    {
        var prize = await _db.SpinPrizes.FirstOrDefaultAsync(p => p.Id == id);
        if (prize == null) return NotFound();

        var error = await ApplyPrizeAsync(prize, request, isNew: false);
        if (error != null) return BadRequest(new { error });

        await _db.SaveChangesAsync();
        return Ok(await LoadAdminPrizeAsync(prize.Id));
    }

    [HttpDelete("prizes/{id:guid}")]
    public async Task<IActionResult> DeletePrize(Guid id)
    {
        var prize = await _db.SpinPrizes.FirstOrDefaultAsync(p => p.Id == id);
        if (prize == null) return NotFound();

        _db.SpinPrizes.Remove(prize);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("game-options")]
    public async Task<IActionResult> GetGameOptions([FromQuery] string? search)
    {
        var query = _db.Games.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(g => g.Name.ToLower().Contains(s));
        }

        var games = await query
            .OrderBy(g => g.Name)
            .Take(50)
            .Select(g => new { g.Id, g.Name })
            .ToListAsync();
        return Ok(games);
    }

    /// <summary>Validates the request and copies it onto the entity. Returns a Vietnamese error or null.</summary>
    private async Task<string?> ApplyPrizeAsync(SpinPrize prize, PrizeUpsertRequest req, bool isNew)
    {
        if (!Enum.IsDefined(req.Type)) return "Loại giải thưởng không hợp lệ.";

        var probability = Math.Round(req.Probability, 2, MidpointRounding.AwayFromZero);
        if (probability < 0.01m || probability > 100m)
            return "Tỉ lệ phải nằm trong khoảng 0.01% đến 100%.";

        var name = (req.Name ?? string.Empty).Trim();
        if (name.Length > 100) return "Tên giải thưởng tối đa 100 ký tự.";

        Guid? gameId = null;
        switch (req.Type)
        {
            case SpinPrizeType.Game:
                if (req.GameId == null || req.GameId == Guid.Empty) return "Vui lòng chọn game cho giải thưởng.";
                var game = await _db.Games.AsNoTracking()
                    .Where(g => g.Id == req.GameId)
                    .Select(g => new { g.Id, g.Name })
                    .FirstOrDefaultAsync();
                if (game == null) return "Game không tồn tại.";
                gameId = game.Id;
                if (name.Length == 0) name = game.Name.Length > 100 ? game.Name[..100] : game.Name;
                break;
            case SpinPrizeType.Discount:
                if (name.Length == 0) return "Vui lòng nhập tên giải giảm giá (ví dụ: \"Giảm 10%\").";
                break;
            case SpinPrizeType.Luck:
                if (name.Length == 0) name = DefaultLuckName;
                break;
        }

        // Active total (excluding this prize's stored value) + this prize if active must be <= 100%.
        var otherActive = await _db.SpinPrizes.AsNoTracking()
            .Where(p => p.IsActive && (isNew || p.Id != prize.Id))
            .Select(p => p.Probability)
            .ToListAsync();
        var totalBp = otherActive.Sum(LuckySpinRules.ToBasisPoints)
                      + (req.IsActive ? LuckySpinRules.ToBasisPoints(probability) : 0);
        if (totalBp > LuckySpinRules.TotalBasisPoints)
        {
            var pct = (totalBp / 100m).ToString("0.##", CultureInfo.InvariantCulture);
            return $"Tổng tỉ lệ các giải đang bật vượt quá 100% (hiện tại {pct}%).";
        }

        prize.Name = name;
        prize.Type = req.Type;
        prize.GameId = gameId;
        prize.Probability = probability;
        prize.IsActive = req.IsActive;
        prize.DisplayOrder = req.DisplayOrder;
        prize.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    private async Task<AdminPrizeDto> LoadAdminPrizeAsync(Guid id)
    {
        var prize = await _db.SpinPrizes.AsNoTracking()
            .Include(p => p.Game).ThenInclude(g => g!.Media)
            .FirstAsync(p => p.Id == id);
        return await ToAdminPrizeAsync(prize);
    }

    private async Task<AdminPrizeDto> ToAdminPrizeAsync(SpinPrize p) => new(
        p.Id,
        p.Name,
        p.Type,
        p.GameId,
        p.Game?.Name,
        await LuckySpinRules.ResolveImageUrlAsync(_minio, p),
        p.Probability,
        LuckySpinRules.RarityFor(p.Probability),
        p.IsActive,
        p.DisplayOrder);

    // ───────────────────────── Codes ─────────────────────────

    [HttpGet("codes")]
    public async Task<IActionResult> GetCodes([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        (page, pageSize) = ClampPaging(page, pageSize);
        var query = _db.SpinCodes.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToUpperInvariant();
            query = query.Where(c => c.Code.Contains(s));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var now = DateTime.UtcNow;
        return Ok(new
        {
            items = items.Select(c => ToAdminCode(c, now)).ToList(),
            totalCount = total,
            page,
            pageSize
        });
    }

    [HttpPost("codes/generate")]
    public async Task<IActionResult> GenerateCodes([FromBody] GenerateCodesRequest request)
    {
        if (request.Count < 1 || request.Count > 500)
            return BadRequest(new { error = "Số lượng mã phải từ 1 đến 500." });

        var maxUses = request.MaxUses ?? 1;
        if (maxUses < 1 || maxUses > 1000)
            return BadRequest(new { error = "Số lượt dùng mỗi mã phải từ 1 đến 1000." });

        DateTime? expiresAt = null;
        if (request.ExpiresAt.HasValue)
        {
            var exp = request.ExpiresAt.Value;
            expiresAt = exp.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(exp, DateTimeKind.Utc)
                : exp.ToUniversalTime();
            if (expiresAt <= DateTime.UtcNow)
                return BadRequest(new { error = "Thời hạn phải ở tương lai." });
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note != null && note.Length > 200)
            return BadRequest(new { error = "Ghi chú tối đa 200 ký tự." });

        // Generate unique codes: dedupe within the batch and regenerate any that already exist.
        var codes = new HashSet<string>();
        for (var round = 0; round < 10 && codes.Count < request.Count; round++)
        {
            var batch = new HashSet<string>();
            while (codes.Count + batch.Count < request.Count)
            {
                var c = LuckySpinRules.GenerateCode(LuckySpinRules.SpinCodeLength);
                if (!codes.Contains(c)) batch.Add(c);
            }
            var batchList = batch.ToList();
            var existing = await _db.SpinCodes.AsNoTracking()
                .Where(sc => batchList.Contains(sc.Code))
                .Select(sc => sc.Code)
                .ToListAsync();
            batch.ExceptWith(existing);
            codes.UnionWith(batch);
        }
        if (codes.Count < request.Count)
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Không thể tạo đủ mã, vui lòng thử lại." });

        var now = DateTime.UtcNow;
        var list = codes.ToList();
        _db.SpinCodes.AddRange(list.Select(c => new SpinCode
        {
            Id = Guid.NewGuid(),
            Code = c,
            MaxUses = maxUses,
            UsedCount = 0,
            ExpiresAt = expiresAt,
            IsActive = true,
            Note = note,
            CreatedAt = now
        }));
        await _db.SaveChangesAsync();

        return Ok(new { codes = list });
    }

    [HttpPatch("codes/{id:guid}")]
    public async Task<IActionResult> ToggleCode(Guid id, [FromBody] ToggleCodeRequest request)
    {
        var code = await _db.SpinCodes.FirstOrDefaultAsync(c => c.Id == id);
        if (code == null) return NotFound();

        code.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ToAdminCode(code, DateTime.UtcNow));
    }

    [HttpDelete("codes/{id:guid}")]
    public async Task<IActionResult> DeleteCode(Guid id)
    {
        var code = await _db.SpinCodes.FirstOrDefaultAsync(c => c.Id == id);
        if (code == null) return NotFound();

        _db.SpinCodes.Remove(code);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object ToAdminCode(SpinCode c, DateTime now)
    {
        string status;
        if (!c.IsActive) status = "Disabled";
        else if (c.ExpiresAt != null && c.ExpiresAt <= now) status = "Expired";
        else if (c.UsedCount >= c.MaxUses) status = "UsedUp";
        else status = "Active";

        return new
        {
            c.Id,
            c.Code,
            c.MaxUses,
            c.UsedCount,
            c.ExpiresAt,
            c.IsActive,
            c.Note,
            status,
            c.CreatedAt
        };
    }

    // ───────────────────────── History ─────────────────────────

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] string? search, [FromQuery] bool? claimed,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        (page, pageSize) = ClampPaging(page, pageSize);
        var query = _db.SpinHistories.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToUpperInvariant();
            query = query.Where(h => h.CodeText.Contains(s) || (h.RewardCode != null && h.RewardCode.Contains(s)));
        }
        if (claimed.HasValue)
        {
            var c = claimed.Value;
            query = query.Where(h => h.IsClaimed == c);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            items = items.Select(ToAdminSpin).ToList(),
            totalCount = total,
            page,
            pageSize
        });
    }

    [HttpPatch("history/{id:guid}/claim")]
    public async Task<IActionResult> SetClaimed(Guid id, [FromBody] ClaimSpinRequest request)
    {
        var spin = await _db.SpinHistories.FirstOrDefaultAsync(h => h.Id == id);
        if (spin == null) return NotFound();
        if (spin.PrizeType == SpinPrizeType.Luck)
            return BadRequest(new { error = "Giải 'Chúc may mắn' không có phần thưởng để trao." });

        spin.IsClaimed = request.IsClaimed;
        spin.ClaimedAt = request.IsClaimed ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync();
        return Ok(ToAdminSpin(spin));
    }

    private static object ToAdminSpin(SpinHistory h) => new
    {
        h.Id,
        h.CodeText,
        h.PrizeName,
        h.PrizeType,
        h.GameId,
        h.RewardCode,
        h.IsClaimed,
        h.ClaimedAt,
        h.ClientIp,
        h.CreatedAt
    };

    private static (int page, int pageSize) ClampPaging(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 200));
}

public record PrizeUpsertRequest(
    string? Name,
    SpinPrizeType Type,
    Guid? GameId,
    decimal Probability,
    bool IsActive,
    int DisplayOrder);

public record AdminPrizeDto(
    Guid Id,
    string Name,
    SpinPrizeType Type,
    Guid? GameId,
    string? GameName,
    string? ImageUrl,
    decimal Probability,
    string Rarity,
    bool IsActive,
    int DisplayOrder);

public record GenerateCodesRequest(int Count, int? MaxUses, DateTime? ExpiresAt, string? Note);

public record ToggleCodeRequest(bool IsActive);

public record ClaimSpinRequest(bool IsClaimed);
