using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

// ---- Customer (storefront) ----

public record CouponCartItemDto(Guid GameId, Guid? EditionId = null);

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

// ---- Admin ("Mã giảm giá sự kiện") ----

public record AdminCouponUpsertRequest(
    string? Code,
    string? Name,
    CouponDiscountType DiscountType,
    decimal Value,
    decimal? MaxDiscountAmount,
    decimal? MinOrderAmount,
    Guid? GameId,
    DateTime? StartsAt,
    DateTime? ExpiresAt,
    int? MaxTotalUses,
    int? MaxUsesPerCustomer,
    bool IsActive);

public record AdminCouponBulkRequest(
    string? Prefix,
    int Count,
    string? Name,
    CouponDiscountType DiscountType,
    decimal Value,
    decimal? MaxDiscountAmount,
    decimal? MinOrderAmount,
    Guid? GameId,
    DateTime? StartsAt,
    DateTime? ExpiresAt,
    int? MaxTotalUses,
    int? MaxUsesPerCustomer,
    bool IsActive);

public record ToggleCouponRequest(bool IsActive);

public record AdminCouponDto(
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
    int? MaxTotalUses,
    int MaxUsesPerCustomer,
    int UsedCount,
    bool IsActive,
    string? OwnerUserId,
    string? OwnerEmail,
    DateTime? ClaimedAt,
    Guid? SpinHistoryId,
    string? CreatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record AdminCouponListResponse(IReadOnlyList<AdminCouponDto> Items, int TotalCount, int Page, int PageSize);

public record AdminCouponBulkResponse(int Count, IReadOnlyList<string> Codes);

public record AdminCouponRedemptionDto(
    Guid Id,
    Guid OrderId,
    string OrderCode,
    string OrderStatus,
    string? UserEmail,
    decimal DiscountAmount,
    DateTime CreatedAt,
    DateTime? ReleasedAt);
