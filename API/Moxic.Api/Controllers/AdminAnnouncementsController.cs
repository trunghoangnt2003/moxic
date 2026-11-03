using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record AnnouncementUpsertRequest(
    string? Kind,
    string? Title,
    string? Subtitle,
    string? Body,
    Guid? GameId,
    DateTime? CountdownTo,
    string? CountdownLabel,
    string? CtaLabel,
    string? CtaUrl,
    DateTime? StartsAt,
    DateTime? EndsAt,
    bool IsActive,
    int Priority);

/// <summary>"Thông báo": CRUD for the storefront pop-up announcements.</summary>
[Route("api/admin/announcements")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminAnnouncementsController : ControllerBase
{
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public AdminAnnouncementsController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await _db.Announcements.AsNoTracking()
            .Include(a => a.Game).ThenInclude(g => g!.Media)
            .OrderByDescending(a => a.IsActive).ThenByDescending(a => a.Priority).ThenByDescending(a => a.UpdatedAt)
            .ToListAsync();
        var items = new List<AnnouncementDto>();
        foreach (var a in rows) items.Add(await AnnouncementMapper.ToDtoAsync(a, _minio));
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AnnouncementUpsertRequest request)
    {
        var a = new Announcement { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        var error = await ApplyAsync(a, request);
        if (error != null) return error;
        _db.Announcements.Add(a);
        await _db.SaveChangesAsync();
        return Ok(await LoadDtoAsync(a.Id));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] AnnouncementUpsertRequest request)
    {
        var a = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFoundResult();
        var error = await ApplyAsync(a, request);
        if (error != null) return error;
        await _db.SaveChangesAsync();
        return Ok(await LoadDtoAsync(id));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var a = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFoundResult();
        var key = a.ImageObjectKey;
        _db.Announcements.Remove(a);
        await _db.SaveChangesAsync();
        await TryDeleteObjectAsync(key);
        return NoContent();
    }

    [HttpPost("{id:guid}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile? file)
    {
        var a = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFoundResult();
        if (file == null || file.Length == 0) return BadRequest(new { error = "Vui lòng chọn ảnh." });
        if (file.Length > MaxImageBytes) return BadRequest(new { error = "Ảnh tối đa 5MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!MediaSniffer.ImageExtensions.Contains(ext))
            return BadRequest(new { error = "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP." });
        await using (var sniff = file.OpenReadStream())
        {
            if (!MediaSniffer.IsImage(sniff, ext)) return BadRequest(new { error = "File không phải ảnh hợp lệ." });
        }

        var key = $"announcements/{id}/{Guid.NewGuid()}{ext}";
        await using (var stream = file.OpenReadStream())
        {
            await _minio.UploadImageAsync(LuckySpinRules.GameBucket, key, stream, MediaSniffer.ContentTypeFor(ext)!);
        }

        var previous = a.ImageObjectKey;
        a.ImageObjectKey = key;
        a.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        if (previous != null && previous != key) await TryDeleteObjectAsync(previous);
        return Ok(await LoadDtoAsync(id));
    }

    [HttpDelete("{id:guid}/image")]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var a = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFoundResult();
        var previous = a.ImageObjectKey;
        a.ImageObjectKey = null;
        a.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await TryDeleteObjectAsync(previous);
        return Ok(await LoadDtoAsync(id));
    }

    private async Task<IActionResult?> ApplyAsync(Announcement a, AnnouncementUpsertRequest r)
    {
        var kind = AnnouncementMapper.Kinds.FirstOrDefault(k => string.Equals(k, r.Kind, StringComparison.OrdinalIgnoreCase));
        if (kind == null) return BadRequest(new { error = "Loại thông báo không hợp lệ." });

        var title = (r.Title ?? string.Empty).Trim();
        if (title.Length < 2 || title.Length > 150) return BadRequest(new { error = "Tiêu đề phải từ 2–150 ký tự." });

        string? Clean(string? v, int max) => string.IsNullOrWhiteSpace(v) ? null : v.Trim()[..Math.Min(v.Trim().Length, max)];

        if (r.GameId.HasValue && !await _db.Games.AnyAsync(g => g.Id == r.GameId))
            return BadRequest(new { error = "Không tìm thấy game." });

        var ctaUrl = Clean(r.CtaUrl, 500);
        if (ctaUrl != null && !AnnouncementMapper.IsSafeUrl(ctaUrl))
            return BadRequest(new { error = "Link nút phải là đường dẫn trong web (bắt đầu bằng /) hoặc URL http(s)." });

        if (r.StartsAt.HasValue && r.EndsAt.HasValue && r.EndsAt <= r.StartsAt)
            return BadRequest(new { error = "Thời gian kết thúc phải sau thời gian bắt đầu." });

        a.Kind = kind;
        a.Title = title;
        a.Subtitle = Clean(r.Subtitle, 300);
        a.Body = Clean(r.Body, 2000);
        a.GameId = r.GameId;
        a.CountdownTo = r.CountdownTo?.ToUniversalTime();
        a.CountdownLabel = Clean(r.CountdownLabel, 100);
        a.CtaLabel = Clean(r.CtaLabel, 60);
        a.CtaUrl = ctaUrl;
        a.StartsAt = r.StartsAt?.ToUniversalTime();
        a.EndsAt = r.EndsAt?.ToUniversalTime();
        a.IsActive = r.IsActive;
        a.Priority = Math.Clamp(r.Priority, -1000, 1000);
        a.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    private async Task<AnnouncementDto> LoadDtoAsync(Guid id)
    {
        var a = await _db.Announcements.AsNoTracking()
            .Include(x => x.Game).ThenInclude(g => g!.Media)
            .FirstAsync(x => x.Id == id);
        return await AnnouncementMapper.ToDtoAsync(a, _minio);
    }

    private async Task TryDeleteObjectAsync(string? key)
    {
        if (string.IsNullOrEmpty(key)) return;
        try { await _minio.DeleteObjectAsync(LuckySpinRules.GameBucket, key); } catch { /* best effort */ }
    }

    private NotFoundObjectResult NotFoundResult() => NotFound(new { error = "Không tìm thấy thông báo." });
}
