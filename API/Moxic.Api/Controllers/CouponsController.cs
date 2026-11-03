using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Moxic.Api.Models;
using Moxic.Api.Services;

namespace Moxic.Api.Controllers;

/// <summary>Checkout coupon preview. Login required (guests get a bare 401).</summary>
[Route("api/coupons")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class CouponsController : ControllerBase
{
    private readonly CouponService _coupons;

    public CouponsController(CouponService coupons)
    {
        _coupons = coupons;
    }

    // POST /api/coupons/validate — server-computed preview (subtotal, discount, total)
    [HttpPost("validate")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Validate([FromBody] CouponValidateRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Forbid(CustomerAuthRules.Scheme);

        var gameIds = (request.Items ?? Array.Empty<CouponCartItemDto>()).Select(i => i.GameId).ToList();
        var (lines, cartError) = await _coupons.PriceLinesAsync(gameIds);
        if (lines == null) return BadRequest(new { error = cartError, code = "CART_INVALID" });

        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { error = "Vui lòng nhập mã giảm giá.", code = CouponRules.ErrNotFound });

        var (eval, coupon, gameName) = await _coupons.QuoteAsync(userId, request.Code, lines);
        if (!eval.Ok || coupon == null) return BadRequest(new { error = eval.Error, code = eval.ErrorCode });

        return Ok(CouponService.ToQuoteDto(coupon, eval, gameName));
    }
}
