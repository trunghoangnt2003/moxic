using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>"Mã giảm giá của tôi": the logged-in customer's own coupons + claiming a spin reward code.</summary>
[Route("api/account/coupons")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class AccountCouponsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly CouponService _coupons;

    public AccountCouponsController(MoxicDbContext db, CouponService coupons)
    {
        _db = db;
        _coupons = coupons;
    }

    // GET /api/account/coupons
    [HttpGet]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Forbid(CustomerAuthRules.Scheme);
        return Ok(new WalletCouponsResponse(await _coupons.GetWalletAsync(userId)));
    }

    // POST /api/account/coupons/claim — bind an unowned SpinReward coupon to this account
    [HttpPost("claim")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Claim([FromBody] ClaimCouponRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Forbid(CustomerAuthRules.Scheme);

        // Owner bind + spin-history "claimed" flag commit together.
        await using var tx = await _db.Database.BeginTransactionAsync();
        var (status, body) = await _coupons.ClaimAsync(userId, request.Code);
        if (status == StatusCodes.Status200OK) await tx.CommitAsync();
        else await tx.RollbackAsync();
        return StatusCode(status, body);
    }
}
