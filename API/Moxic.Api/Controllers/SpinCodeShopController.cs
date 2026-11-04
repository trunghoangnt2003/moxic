using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

public record BuySpinCodeRequest(int Quantity);

public record SpinCodeOrderDto(
    Guid Id,
    string TransferContent,
    string CaseSlug,
    string CaseName,
    int Quantity,
    decimal UnitPrice,
    decimal Amount,
    string Status,
    string? QrUrl,
    string? BankName,
    string? BankAccountNumber,
    string? BankAccountHolder,
    bool AutoConfirm,
    string? SpinCode,
    DateTime CreatedAt,
    DateTime? PaidAt);

/// <summary>Customers buy spins for a code case by bank transfer (SePay confirms automatically).</summary>
[ApiController]
public class SpinCodeShopController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly SpinCodeShopService _shop;
    private readonly IConfiguration _config;

    public SpinCodeShopController(MoxicDbContext db, SpinCodeShopService shop, IConfiguration config)
    {
        _db = db;
        _shop = shop;
        _config = config;
    }

    private async Task<string?> CustomerIdAsync()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        if (!auth.Succeeded || auth.Principal == null || !auth.Principal.IsInRole(CustomerAuthRules.CustomerRole)) return null;
        return auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    // POST /api/lucky-spin/cases/{slug}/buy-code
    [HttpPost("api/lucky-spin/cases/{slug}/buy-code")]
    public async Task<IActionResult> Buy(string slug, [FromBody] BuySpinCodeRequest req)
    {
        var userId = await CustomerIdAsync();
        if (userId == null) return Unauthorized(new { error = "Vui lòng đăng nhập để mua lượt quay." });

        var s = (slug ?? string.Empty).Trim().ToLowerInvariant();
        var spinCase = await _db.SpinCases.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == s && c.IsActive);
        if (spinCase == null) return NotFound(new { error = "Không tìm thấy hòm." });

        var (order, error) = await _shop.CreateAsync(userId, spinCase, req.Quantity);
        if (order == null) return BadRequest(new { error });
        order.Case = spinCase;
        return Ok(await ToDtoAsync(order));
    }

    // GET /api/lucky-spin/code-orders/{id}
    [HttpGet("api/lucky-spin/code-orders/{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var userId = await CustomerIdAsync();
        if (userId == null) return Unauthorized(new { error = "Vui lòng đăng nhập." });
        var order = await _db.SpinCodeOrders.AsNoTracking().Include(o => o.Case).Include(o => o.SpinCode)
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);
        return order == null ? NotFound(new { error = "Không tìm thấy đơn." }) : Ok(await ToDtoAsync(order));
    }

    private async Task<SpinCodeOrderDto> ToDtoAsync(SpinCodeOrder o)
    {
        var cfg = await _db.PaymentConfigs.AsNoTracking().FirstOrDefaultAsync();
        var paid = o.Status == "Paid";
        return new SpinCodeOrderDto(
            o.Id, o.Code, o.Case?.Slug ?? "", RequestLanguage.Pick(o.Case?.Name ?? "", o.Case?.NameEn),
            o.Quantity, o.UnitPrice, o.Amount, o.Status,
            paid ? null : BankPaymentService.VietQrUrl(cfg, o.Amount, o.Code),
            cfg?.BankName, cfg?.BankAccountNumber, cfg?.BankAccountHolder,
            !string.IsNullOrWhiteSpace(_config["Sepay:ApiKey"]),
            paid ? o.SpinCode?.Code : null,
            o.CreatedAt, o.PaidAt);
    }
}
