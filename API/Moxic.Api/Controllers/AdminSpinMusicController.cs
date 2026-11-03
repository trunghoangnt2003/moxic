using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>"Kho nhạc": background music for the case-opening page (mp3/ogg/m4a, max 10MB, sniffed).</summary>
[Route("api/admin/spin-music")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminSpinMusicController : ControllerBase
{
    private const long MaxAudioBytes = 10 * 1024 * 1024;

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public AdminSpinMusicController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetTracks()
    {
        var tracks = await _db.SpinMusicTracks.AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
        var result = new List<AdminMusicTrackDto>();
        foreach (var t in tracks) result.Add(await ToDtoAsync(t));
        return Ok(result);
    }

    [HttpPost]
    [RequestSizeLimit(12_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 12_000_000)]
    public async Task<IActionResult> Upload(IFormFile? file, [FromForm] string? name)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "Vui lòng chọn file nhạc." });
        if (file.Length > MaxAudioBytes) return BadRequest(new { error = "File nhạc tối đa 10MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!MediaSniffer.AudioExtensions.Contains(ext))
            return BadRequest(new { error = "Chỉ hỗ trợ file MP3, OGG hoặc M4A." });

        await using (var sniff = file.OpenReadStream())
        {
            if (!MediaSniffer.IsAudio(sniff, ext))
                return BadRequest(new { error = "File không phải định dạng âm thanh hợp lệ." });
        }

        var trackName = string.IsNullOrWhiteSpace(name) ? Path.GetFileNameWithoutExtension(file.FileName) : name;
        trackName = (trackName ?? string.Empty).Trim();
        if (trackName.Length == 0) trackName = "Bài nhạc";
        if (trackName.Length > 100) trackName = trackName[..100];

        var contentType = MediaSniffer.ContentTypeFor(ext)!;
        var key = $"spin-music/{Guid.NewGuid()}{ext}";
        await using (var stream = file.OpenReadStream())
        {
            await _minio.UploadImageAsync(Bucket(), key, stream, contentType);
        }

        var track = new SpinMusicTrack
        {
            Id = Guid.NewGuid(),
            Name = trackName,
            ObjectKey = key,
            ContentType = contentType,
            SizeBytes = file.Length,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _db.SpinMusicTracks.Add(track);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, await ToDtoAsync(track));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMusicTrackRequest request)
    {
        var track = await _db.SpinMusicTracks.FirstOrDefaultAsync(t => t.Id == id);
        if (track == null) return NotFound(new { error = "Không tìm thấy bài nhạc." });

        if (request.Name != null)
        {
            var trimmed = request.Name.Trim();
            if (trimmed.Length < 1 || trimmed.Length > 100)
                return BadRequest(new { error = "Tên bài nhạc phải từ 1 đến 100 ký tự." });
            track.Name = trimmed;
        }
        if (request.IsActive.HasValue) track.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(await ToDtoAsync(track));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var track = await _db.SpinMusicTracks.FirstOrDefaultAsync(t => t.Id == id);
        if (track == null) return NotFound(new { error = "Không tìm thấy bài nhạc." });

        var key = track.ObjectKey;
        _db.SpinMusicTracks.Remove(track);
        await _db.SaveChangesAsync();
        try { await _minio.DeleteObjectAsync(Bucket(), key); } catch { /* best effort */ }
        return NoContent();
    }

    private async Task<AdminMusicTrackDto> ToDtoAsync(SpinMusicTrack t)
    {
        string url;
        try { url = await _minio.GetPresignedUrlAsync(Bucket(), t.ObjectKey, ExpiryHours()); }
        catch { url = string.Empty; }
        return new AdminMusicTrackDto(t.Id, t.Name, url, t.ContentType, t.SizeBytes, t.IsActive, t.CreatedAt);
    }

    private string Bucket() => _config.GetValue<string>("Minio:GamesBucket") ?? LuckySpinRules.GameBucket;

    private int ExpiryHours()
    {
        var hours = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        return hours > 0 ? hours : 1;
    }
}
