using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record TranslationField(string Field, string Label, string? Vi, string? En, bool Multiline);
public record TranslationRow(string Entity, Guid Id, string Title, IReadOnlyList<TranslationField> Fields);
public record TranslationSaveRequest(string? Entity, Guid Id, string? Field, string? Value);

/// <summary>
/// One place to edit the English (/en) version of customer-facing content: games, FAQ, announcements,
/// lucky-spin cases and prizes, reward-shop items. Empty English = the site shows the Vietnamese.
/// </summary>
[ApiController]
[Route("api/admin/translations")]
[Authorize(Roles = "Admin")]
public class AdminTranslationsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly SeoContentService _seo;

    public AdminTranslationsController(MoxicDbContext db, SeoContentService seo)
    {
        _db = db;
        _seo = seo;
    }

    private static TranslationField F(string field, string label, string? vi, string? en, bool multiline = false) =>
        new(field, label, vi, en, multiline);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var rows = new List<TranslationRow>();

        foreach (var g in await _db.Games.AsNoTracking().OrderBy(g => g.Name).ToListAsync())
            rows.Add(new("Game", g.Id, g.Name, [F("Name", "Tên game", g.Name, g.NameEn), F("Description", "Mô tả", g.Description, g.DescriptionEn, true)]));

        foreach (var f in await _db.FaqItems.AsNoTracking().OrderBy(f => f.DisplayOrder).ToListAsync())
            rows.Add(new("Faq", f.Id, f.Question, [F("Question", "Câu hỏi", f.Question, f.QuestionEn), F("Answer", "Trả lời", f.Answer, f.AnswerEn, true)]));

        foreach (var a in await _db.Announcements.AsNoTracking().OrderByDescending(a => a.UpdatedAt).ToListAsync())
            rows.Add(new("Announcement", a.Id, a.Title, [
                F("Title", "Tiêu đề", a.Title, a.TitleEn), F("Subtitle", "Phụ đề", a.Subtitle, a.SubtitleEn),
                F("Body", "Nội dung", a.Body, a.BodyEn, true), F("CountdownLabel", "Nhãn đếm ngược", a.CountdownLabel, a.CountdownLabelEn),
                F("CtaLabel", "Nhãn nút", a.CtaLabel, a.CtaLabelEn)]));

        foreach (var c in await _db.SpinCases.AsNoTracking().OrderBy(c => c.DisplayOrder).ToListAsync())
            rows.Add(new("SpinCase", c.Id, c.Name, [F("Name", "Tên hòm", c.Name, c.NameEn), F("Description", "Mô tả", c.Description, c.DescriptionEn, true)]));

        var caseNames = await _db.SpinCases.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        foreach (var p in await _db.SpinPrizes.AsNoTracking().OrderBy(p => p.CaseId).ThenBy(p => p.DisplayOrder).ToListAsync())
            rows.Add(new("SpinPrize", p.Id, $"{caseNames.GetValueOrDefault(p.CaseId, "?")}: {p.Name}", [F("Name", "Tên giải", p.Name, p.NameEn)]));

        foreach (var r in await _db.RewardItems.AsNoTracking().OrderBy(r => r.DisplayOrder).ToListAsync())
            rows.Add(new("RewardItem", r.Id, r.Name, [F("Name", "Tên quà", r.Name, r.NameEn), F("Description", "Mô tả", r.Description, r.DescriptionEn)]));

        return Ok(rows);
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] TranslationSaveRequest req)
    {
        var value = string.IsNullOrWhiteSpace(req.Value) ? null : req.Value.Trim();
        if (value is { Length: > 8000 }) return BadRequest(new { error = "Nội dung quá dài (tối đa 8000 ký tự)." });

        bool ok;
        switch (req.Entity)
        {
            case "Game":
                var g = await _db.Games.FindAsync(req.Id);
                ok = g != null && req.Field switch { "Name" => Set(() => g.NameEn = value), "Description" => Set(() => g.DescriptionEn = value), _ => false };
                break;
            case "Faq":
                var f = await _db.FaqItems.FindAsync(req.Id);
                ok = f != null && req.Field switch { "Question" => Set(() => f.QuestionEn = value), "Answer" => Set(() => f.AnswerEn = value), _ => false };
                break;
            case "Announcement":
                var a = await _db.Announcements.FindAsync(req.Id);
                ok = a != null && req.Field switch
                {
                    "Title" => Set(() => a.TitleEn = value), "Subtitle" => Set(() => a.SubtitleEn = value), "Body" => Set(() => a.BodyEn = value),
                    "CountdownLabel" => Set(() => a.CountdownLabelEn = value), "CtaLabel" => Set(() => a.CtaLabelEn = value), _ => false,
                };
                break;
            case "SpinCase":
                var c = await _db.SpinCases.FindAsync(req.Id);
                ok = c != null && req.Field switch { "Name" => Set(() => c.NameEn = value), "Description" => Set(() => c.DescriptionEn = value), _ => false };
                break;
            case "SpinPrize":
                var p = await _db.SpinPrizes.FindAsync(req.Id);
                ok = p != null && req.Field == "Name" && Set(() => p.NameEn = value);
                break;
            case "RewardItem":
                var r = await _db.RewardItems.FindAsync(req.Id);
                ok = r != null && req.Field switch { "Name" => Set(() => r.NameEn = value), "Description" => Set(() => r.DescriptionEn = value), _ => false };
                break;
            default:
                ok = false;
                break;
        }
        if (!ok) return NotFound(new { error = "Không tìm thấy nội dung." });

        await _db.SaveChangesAsync();
        _seo.Invalidate(); // FAQ / SEO caches; the catalog output cache is evicted by the admin-write middleware
        return Ok(new { saved = true });
    }

    private static bool Set(Action apply)
    {
        apply();
        return true;
    }
}
