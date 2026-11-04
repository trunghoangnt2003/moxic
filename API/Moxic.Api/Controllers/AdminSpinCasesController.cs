using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>Admin CRUD for lucky-spin cases ("hòm"), incl. open-method config and cover image.</summary>
[Route("api/admin/lucky-spin/cases")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminSpinCasesController : ControllerBase
{
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public AdminSpinCasesController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetCases()
    {
        var cases = await _db.SpinCases.AsNoTracking()
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .ToListAsync();
        var prizes = await _db.SpinPrizes.AsNoTracking()
            .Select(p => new { p.CaseId, p.IsActive, p.Probability })
            .ToListAsync();
        var codeCounts = await _db.SpinCodes.AsNoTracking()
            .GroupBy(c => c.CaseId)
            .Select(g => new { CaseId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CaseId, x => x.Count);

        var result = new List<AdminCaseDto>();
        foreach (var c in cases)
        {
            var mine = prizes.Where(p => p.CaseId == c.Id).ToList();
            var activeBp = mine.Where(p => p.IsActive).Sum(p => LuckySpinRules.ToBasisPoints(p.Probability));
            var activeCount = mine.Count(p => p.IsActive);
            result.Add(await ToDtoAsync(c, mine.Count, activeCount, activeBp,
                codeCounts.TryGetValue(c.Id, out var n) ? n : 0));
        }
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateCase([FromBody] CaseUpsertRequest request)
    {
        var now = DateTime.UtcNow;
        var spinCase = new SpinCase { Id = Guid.NewGuid(), CreatedAt = now };
        var error = await ApplyAsync(spinCase, request);
        if (error != null) return error;

        _db.SpinCases.Add(spinCase);
        await _db.SaveChangesAsync();
        return StatusCode(StatusCodes.Status201Created, await LoadDtoAsync(spinCase.Id));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateCase(Guid id, [FromBody] CaseUpsertRequest request)
    {
        var spinCase = await _db.SpinCases.FirstOrDefaultAsync(c => c.Id == id);
        if (spinCase == null) return CaseNotFound();

        var error = await ApplyAsync(spinCase, request);
        if (error != null) return error;

        await _db.SaveChangesAsync();
        return Ok(await LoadDtoAsync(id));
    }

    /// <summary>Prizes, codes and cooldowns cascade; history keeps its CaseName snapshot (CaseId -> NULL).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCase(Guid id)
    {
        var spinCase = await _db.SpinCases.FirstOrDefaultAsync(c => c.Id == id);
        if (spinCase == null) return CaseNotFound();

        var imageKey = spinCase.ImageObjectKey;
        _db.SpinCases.Remove(spinCase);
        await _db.SaveChangesAsync();
        await TryDeleteObjectAsync(imageKey);
        return NoContent();
    }

    [HttpPost("{id:guid}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile? file)
    {
        var spinCase = await _db.SpinCases.FirstOrDefaultAsync(c => c.Id == id);
        if (spinCase == null) return CaseNotFound();

        if (file == null || file.Length == 0) return BadRequest(new { error = "Vui lòng chọn ảnh." });
        if (file.Length > MaxImageBytes) return BadRequest(new { error = "Ảnh tối đa 5MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!MediaSniffer.ImageExtensions.Contains(ext))
            return BadRequest(new { error = "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP." });

        await using (var sniff = file.OpenReadStream())
        {
            if (!MediaSniffer.IsImage(sniff, ext))
                return BadRequest(new { error = "File không phải ảnh hợp lệ." });
        }

        var key = $"spin-cases/{id}/{Guid.NewGuid()}{ext}";
        await using (var stream = file.OpenReadStream())
        {
            await _minio.UploadImageAsync(Bucket(), key, stream, MediaSniffer.ContentTypeFor(ext)!);
        }

        var previous = spinCase.ImageObjectKey;
        spinCase.ImageObjectKey = key;
        spinCase.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        if (previous != null && previous != key) await TryDeleteObjectAsync(previous);

        return Ok(await LoadDtoAsync(id));
    }

    [HttpDelete("{id:guid}/image")]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var spinCase = await _db.SpinCases.FirstOrDefaultAsync(c => c.Id == id);
        if (spinCase == null) return CaseNotFound();

        var previous = spinCase.ImageObjectKey;
        spinCase.ImageObjectKey = null;
        spinCase.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await TryDeleteObjectAsync(previous);
        return Ok(await LoadDtoAsync(id));
    }

    // ───────────────────────── helpers ─────────────────────────

    /// <summary>Validates + copies the request. Returns an error result or null.</summary>
    private async Task<IActionResult?> ApplyAsync(SpinCase spinCase, CaseUpsertRequest req)
    {
        var name = (req.Name ?? string.Empty).Trim();
        if (name.Length < 2 || name.Length > 100)
            return BadRequest(new { error = "Tên hòm phải từ 2 đến 100 ký tự." });

        var slug = Slugify(string.IsNullOrWhiteSpace(req.Slug) ? name : req.Slug);
        if (slug.Length > 80) slug = slug[..80].Trim('-');
        if (slug.Length < 2) return BadRequest(new { error = "Slug không hợp lệ." });

        var caseId = spinCase.Id;
        if (await _db.SpinCases.AsNoTracking().AnyAsync(c => c.Slug == slug && c.Id != caseId))
            return Conflict(new { error = "Slug này đã được dùng cho hòm khác." });

        var description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        if (description != null && description.Length > 1000)
            return BadRequest(new { error = "Mô tả tối đa 1000 ký tự." });

        if (!Enum.IsDefined(req.OpenMethod))
            return BadRequest(new { error = "Cách mở hòm không hợp lệ." });

        var hours = 24;
        var cost = 0;
        switch (req.OpenMethod)
        {
            case SpinCaseOpenMethod.FreeInterval:
                hours = req.FreeIntervalHours ?? 24;
                if (hours < 1 || hours > 720)
                    return BadRequest(new { error = "Chu kỳ miễn phí phải từ 1 đến 720 giờ." });
                break;
            case SpinCaseOpenMethod.Points:
                cost = req.PointsCost ?? 0;
                if (cost < 1 || cost > 1_000_000)
                    return BadRequest(new { error = "Số điểm mở hòm phải từ 1 đến 1.000.000." });
                break;
        }

        spinCase.Name = name;
        spinCase.Slug = slug;
        spinCase.Description = description;
        spinCase.OpenMethod = req.OpenMethod;
        spinCase.FreeIntervalHours = hours;
        spinCase.PointsCost = cost;
        var price = req.OpenMethod == SpinCaseOpenMethod.Code ? Math.Round(req.CodePrice ?? 0m) : 0m;
        if (price < 0 || price > 100_000_000m)
            return BadRequest(new { error = "Giá mã quay phải từ 0 đến 100.000.000đ." });
        if (price is > 0 and < 1000)
            return BadRequest(new { error = "Giá mã quay tối thiểu 1.000đ (hoặc 0 để không bán)." });
        spinCase.CodePrice = price;
        spinCase.IsActive = req.IsActive;
        spinCase.DisplayOrder = req.DisplayOrder;
        spinCase.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    /// <summary>Lowercase ASCII slug: Vietnamese diacritics removed (đ -> d), non [a-z0-9] runs -> '-'.</summary>
    public static string Slugify(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var lowered = input.Trim().ToLowerInvariant().Replace('đ', 'd');
        var decomposed = lowered.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var dash = false;
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9'))
            {
                sb.Append(ch);
                dash = false;
            }
            else if (!dash)
            {
                sb.Append('-');
                dash = true;
            }
        }
        return sb.ToString().Trim('-');
    }

    private async Task<AdminCaseDto> LoadDtoAsync(Guid id)
    {
        var c = await _db.SpinCases.AsNoTracking().FirstAsync(x => x.Id == id);
        var prizes = await _db.SpinPrizes.AsNoTracking()
            .Where(p => p.CaseId == id)
            .Select(p => new { p.IsActive, p.Probability })
            .ToListAsync();
        var codeCount = await _db.SpinCodes.AsNoTracking().CountAsync(x => x.CaseId == id);
        var activeBp = prizes.Where(p => p.IsActive).Sum(p => LuckySpinRules.ToBasisPoints(p.Probability));
        return await ToDtoAsync(c, prizes.Count, prizes.Count(p => p.IsActive), activeBp, codeCount);
    }

    private async Task<AdminCaseDto> ToDtoAsync(SpinCase c, int prizeCount, int activeCount, int activeBp, int codeCount)
    {
        string? imageUrl = null;
        if (!string.IsNullOrEmpty(c.ImageObjectKey))
        {
            try { imageUrl = await _minio.GetPresignedUrlAsync(Bucket(), c.ImageObjectKey, ExpiryHours()); }
            catch { imageUrl = null; }
        }
        return new AdminCaseDto(
            c.Id, c.Name, c.Slug, c.Description, imageUrl, c.OpenMethod, c.FreeIntervalHours, c.PointsCost,
            c.IsActive, c.DisplayOrder, prizeCount, activeCount, activeBp / 100m,
            activeCount > 0 && activeBp == LuckySpinRules.TotalBasisPoints,
            codeCount, c.CreatedAt, c.UpdatedAt, c.CodePrice);
    }

    private async Task TryDeleteObjectAsync(string? key)
    {
        if (string.IsNullOrEmpty(key)) return;
        try { await _minio.DeleteObjectAsync(Bucket(), key); } catch { /* best effort */ }
    }

    private string Bucket() => _config.GetValue<string>("Minio:GamesBucket") ?? LuckySpinRules.GameBucket;

    private int ExpiryHours()
    {
        var hours = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        return hours > 0 ? hours : 1;
    }

    private NotFoundObjectResult CaseNotFound() => NotFound(new { error = "Không tìm thấy hòm." });
}
