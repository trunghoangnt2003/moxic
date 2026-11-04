using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record AssignTransactionRequest(string? OrderCode);

/// <summary>SePay "payment received" webhook + the admin's view of incoming transfers.</summary>
[ApiController]
public class PaymentsController : ControllerBase
{
    private readonly BankPaymentService _payments;
    private readonly MoxicDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(BankPaymentService payments, MoxicDbContext db, IConfiguration config, ILogger<PaymentsController> logger)
    {
        _payments = payments;
        _db = db;
        _config = config;
        _logger = logger;
    }

    private static bool SameSecret(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    // POST /api/payments/sepay — configured in SePay → Webhooks, auth "API Key" (header: Authorization: Apikey KEY)
    [HttpPost("api/payments/sepay")]
    public async Task<IActionResult> Sepay([FromBody] JsonElement body)
    {
        var key = _config["Sepay:ApiKey"];
        if (string.IsNullOrWhiteSpace(key)) return NotFound();
        var auth = Request.Headers.Authorization.ToString().Trim();
        var given = auth.StartsWith("Apikey ", StringComparison.OrdinalIgnoreCase) ? auth[7..].Trim() : "";
        if (given.Length == 0 || !SameSecret(given, key.Trim()))
        {
            _logger.LogWarning("SePay webhook with bad API key from {Ip}", HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new { success = false });
        }

        string? S(string name) => body.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : null;
        var type = S("transferType");
        var id = S("id");
        if (id == null || !decimal.TryParse(S("transferAmount"), NumberStyles.Number, CultureInfo.InvariantCulture, out var amount))
            return BadRequest(new { success = false, message = "missing id/transferAmount" });
        if (!string.Equals(type, "in", StringComparison.OrdinalIgnoreCase) || amount <= 0)
            return Ok(new { success = true }); // money going out — not ours to reconcile

        DateTime? date = null;
        if (DateTime.TryParseExact(S("transactionDate"), "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            date = DateTime.SpecifyKind(d.AddHours(-7), DateTimeKind.Utc); // SePay sends Vietnam local time

        var content = S("content") ?? S("description");
        await _payments.HandleIncomingAsync("sepay", id, amount, content, S("gateway"), S("accountNumber"), S("referenceCode"), date);
        return Ok(new { success = true });
    }

    // ---- admin ----

    [HttpGet("api/admin/payments/transactions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Transactions([FromQuery] string? status, [FromQuery] int page = 1)
    {
        page = Math.Max(1, page);
        var q = _db.BankTransactions.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(t => t.Status == status);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(t => t.CreatedAt).Skip((page - 1) * 50).Take(50).ToListAsync();
        return Ok(new
        {
            autoConfirm = _payments.AutoConfirmEnabled,
            webhookUrl = $"{(_config["Site:ApiBaseUrl"] ?? "https://api.moxic.co").TrimEnd('/')}/api/payments/sepay",
            total,
            items,
        });
    }

    [HttpPost("api/admin/payments/transactions/{id:guid}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignTransactionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.OrderCode)) return BadRequest(new { error = "Nhập mã đơn" });
        var (ok, error) = await _payments.AssignAsync(id, req.OrderCode, User.Identity?.Name);
        return ok ? NoContent() : BadRequest(new { error });
    }
}
