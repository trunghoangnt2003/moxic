using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

// ---- Customer (storefront) ----

public record CouponCartItemDto(Guid GameId);

public record CouponValidateRequest(string? Code, IReadOnlyList<CouponCartItemDto>? Items);

/// <summary>Server-computed preview. Never carries owner/redemption details.</summary>
public record CouponQuoteDto(
    string Code,
    string Name,
    CouponSource Source,
    CouponDiscountType DiscountType,
    decimal Value,
    decimal? MaxDiscountAmount,
    decimal? MinOrderAmount,
    Guid? GameId,
    string? GameName,
    DateTime? ExpiresAt,
    decimal Subtotal,
    decimal ApplicableAmount,
    decimal DiscountAmount,
    decimal Total);

public record WalletCouponDto(
    Guid Id,
    string Code,
    string Name,
    CouponSource Source,
    CouponDiscountType DiscountType,
    decimal Value,
    decimal? MaxDiscountAmount,
    decimal? MinOrderAmount,
    Guid? GameId,
    string? GameName,
    DateTime? StartsAt,
    DateTime? ExpiresAt,
    string Status,
    int UsesLeft,
    DateTime CreatedAt);

public record WalletCouponsResponse(IReadOnlyList<WalletCouponDto> Items);

public record ClaimCouponRequest(string? Code);

public record ClaimCouponResponse(WalletCouponDto Coupon, bool AlreadyOwned);
