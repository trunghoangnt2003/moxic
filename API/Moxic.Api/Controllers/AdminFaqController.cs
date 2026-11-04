using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record FaqUpsertRequest(string? Question, string? Answer, int DisplayOrder, bool IsActive);

/// <summary>Admin CRUD for the public FAQ (/hoi-dap, FAQPage structured data, llms.txt).</summary>
[ApiController]
[Route("api/admin/faq")]
[Authorize(Roles = "Admin")]
public class AdminFaqController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly SeoContentService _seo;
    private readonly IndexNowService _indexNow;

    public AdminFaqController(MoxicDbContext db, SeoContentService seo, IndexNowService indexNow)
    {
        _db = db;
        _seo = seo;
        _indexNow = indexNow;
    }

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await _db.FaqItems.AsNoTracking().OrderBy(f => f.DisplayOrder).ToListAsync());

    private static string? Validate(FaqUpsertRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Question) || r.Question.Trim().Length > 300) return "Câu hỏi 1–300 ký tự";
        if (string.IsNullOrWhiteSpace(r.Answer) || r.Answer.Trim().Length > 3000) return "Câu trả lời 1–3000 ký tự";
        return null;
    }

    private void Changed()
    {
        _seo.Invalidate();
        _indexNow.Enqueue("/hoi-dap", "/", "/llms.txt");
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FaqUpsertRequest r)
    {
        if (Validate(r) is { } err) return BadRequest(new { error = err });
        var f = new FaqItem { Id = Guid.NewGuid(), Question = r.Question!.Trim(), Answer = r.Answer!.Trim(), DisplayOrder = r.DisplayOrder, IsActive = r.IsActive, UpdatedAt = DateTime.UtcNow };
        _db.FaqItems.Add(f);
        await _db.SaveChangesAsync();
        Changed();
        return Ok(f);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] FaqUpsertRequest r)
    {
        if (Validate(r) is { } err) return BadRequest(new { error = err });
        var f = await _db.FaqItems.FirstOrDefaultAsync(x => x.Id == id);
        if (f == null) return NotFound();
        f.Question = r.Question!.Trim();
        f.Answer = r.Answer!.Trim();
        f.DisplayOrder = r.DisplayOrder;
        f.IsActive = r.IsActive;
        f.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        Changed();
        return Ok(f);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var n = await _db.FaqItems.Where(x => x.Id == id).ExecuteDeleteAsync();
        if (n == 0) return NotFound();
        Changed();
        return NoContent();
    }
}
