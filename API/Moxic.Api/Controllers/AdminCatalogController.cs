using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Moxic.Api.Services.Catalog;

namespace Moxic.Api.Controllers;

/// <summary>Admin "Kho game Xbox": crawl the Xbox Store VN catalog, the review queue, CSV import and the price formula.</summary>
[ApiController]
[Route("api/admin/catalog")]
[Authorize(Roles = "Admin")]
public class AdminCatalogController : ControllerBase
{
    private readonly CatalogImportService _import;
    private readonly CatalogCrawlJob _job;
    private readonly XboxBrowseClient _xbox;
    private readonly CatalogPublishJob _publisher;

    public AdminCatalogController(CatalogImportService import, CatalogCrawlJob job, XboxBrowseClient xbox, CatalogPublishJob publisher)
    {
        _publisher = publisher;
        _import = import;
        _job = job;
        _xbox = xbox;
    }

    public record CrawlBody(int Limit);
    public record PriceBody(decimal? SalePrice, string Mode);
    public record IdsBody(List<Guid> Ids);
    public record FormulaBody(decimal PricePercent, decimal PriceAdd, decimal PriceRoundTo);
    public record ApplyBody(bool IncludePublished);

    // POST /api/admin/catalog/crawl {limit: 0 (all) | 100 | 500 | 2000}
    [HttpPost("crawl")]
    public IActionResult Crawl([FromBody] CrawlBody body)
    {
        if (body.Limit < 0 || body.Limit > 50_000) return BadRequest(new { error = "Số lượng không hợp lệ" });
        return _job.TryStart(body.Limit) ? Ok(_job.Status) : Conflict(new { error = "Đang có một lần cào chạy, chờ xong nhé" });
    }

    [HttpGet("crawl")]
    public IActionResult CrawlStatus() => Ok(_job.Status);

    [HttpPost("crawl/stop")]
    public IActionResult Stop()
    {
        _job.Stop();
        return Ok(_job.Status);
    }

    // GET /api/admin/catalog/pending?q=&hot=true&sort=popular|new|price|added&page=1&pageSize=50
    [HttpGet("pending")]
    public async Task<IActionResult> Pending([FromQuery] string? q, [FromQuery] bool hot = false, [FromQuery] string? sort = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var (items, total) = await _import.PendingAsync(q, hot, sort, page, pageSize, _publisher.QueuedIds);
        return Ok(new { items, total, page, hotRank = CatalogImportService.HotRank });
    }

    [HttpPut("pending/{id:guid}/price")]
    public async Task<IActionResult> SetPrice(Guid id, [FromBody] PriceBody body)
    {
        var error = await _import.SetPriceAsync(id, body.SalePrice, body.Mode);
        return error == null ? Ok(new { ok = true }) : BadRequest(new { error });
    }

    // POST /api/admin/catalog/publish {ids} — queued and published in the background; poll GET publish for progress
    [HttpPost("publish")]
    public IActionResult Publish([FromBody] IdsBody body)
    {
        if (body.Ids.Count is 0 or > 5000) return BadRequest(new { error = "Chọn game cần đăng" });
        return Ok(_publisher.Enqueue(body.Ids));
    }

    [HttpGet("publish")]
    public IActionResult PublishStatus() => Ok(_publisher.Status);

    [HttpPost("delete")]
    public async Task<IActionResult> Delete([FromBody] IdsBody body)
    {
        if (body.Ids.Count is 0 or > 5000) return BadRequest(new { error = "Chọn game cần xoá" });
        return Ok(new { deleted = await _import.DeletePendingAsync(body.Ids) });
    }

    [HttpGet("formula")]
    public async Task<IActionResult> Formula() => Ok(await _import.GetSettingsAsync());

    [HttpPut("formula")]
    public async Task<IActionResult> SaveFormula([FromBody] FormulaBody body)
    {
        var error = await _import.SaveSettingsAsync(body.PricePercent, body.PriceAdd, body.PriceRoundTo);
        return error == null ? Ok(await _import.GetSettingsAsync()) : BadRequest(new { error });
    }

    [HttpGet("formula/preview")]
    public async Task<IActionResult> Preview([FromQuery] bool includePublished = false) =>
        Ok(new { count = await _import.CountFormulaTargetsAsync(includePublished) });

    [HttpPost("formula/apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyBody body) =>
        Ok(new { changed = await _import.ApplyFormulaAsync(body.IncludePublished) });

    [HttpGet("template")]
    public IActionResult Template() =>
        File(Encoding.UTF8.GetBytes(CatalogCsv.Template()), "text/csv; charset=utf-8", "mau-import-game.csv");

    [HttpPost("import")]
    [RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "Chọn file CSV" });
        if (file.Length > 2 * 1024 * 1024) return BadRequest(new { error = "File tối đa 2MB" });
        using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var results = await _import.ImportCsvAsync(await reader.ReadToEndAsync(ct), ct, _xbox);
        return Ok(results);
    }
}
