using System.Globalization;
using Moxic.Core.Entities;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Pure coupon helpers: code normalization/generation, term validation, rule evaluation and the
/// discount computation. All money is decimal VND rounded to whole đồng (never double). Codes use
/// the CSPRNG alphabet of <see cref="LuckySpinRules"/>.
/// </summary>
public static class CouponRules
{
    public const string RateLimitPolicy = "coupon";
    public const int MaxCartItems = 50;
    public const int DefaultValidDays = 30;
    public const int MaxBulkCount = 500;
    public const int GeneratedRandomLength = 8;
    public const decimal MaxFixedValue = 100_000_000m;

    // Error codes (clients branch on the "COUPON_" prefix)
    public const string ErrNotFound = "COUPON_NOT_FOUND";
    public const string ErrLoginRequired = "COUPON_LOGIN_REQUIRED";
    public const string ErrInactive = "COUPON_INACTIVE";
    public const string ErrNotStarted = "COUPON_NOT_STARTED";
    public const string ErrExpired = "COUPON_EXPIRED";
    public const string ErrNotOwner = "COUPON_NOT_OWNER";
    public const string ErrExhausted = "COUPON_EXHAUSTED";
    public const string ErrUserLimit = "COUPON_USER_LIMIT";
    public const string ErrGameScope = "COUPON_GAME_SCOPE";
    public const string ErrMinOrder = "COUPON_MIN_ORDER";
    public const string ErrNotApplicable = "COUPON_NOT_APPLICABLE";

    public const string MsgNotFound = "Mã giảm giá không tồn tại.";
    public const string MsgLoginRequired = "Đăng nhập để dùng mã giảm giá.";
    public const string MsgNotOwner = "Mã giảm giá này thuộc về tài khoản khác.";
    public const string MsgExhausted = "Mã giảm giá đã hết lượt sử dụng.";
    public const string MsgUserLimit = "Bạn đã dùng hết lượt cho mã này.";

    /// <summary>Trim, drop spaces and '-', uppercase. Null unless 4..32 chars of A-Z0-9.</summary>
    public static string? NormalizeCode(string? raw)
    {
        var cleaned = Clean(raw);
        if (cleaned == null || cleaned.Length < 4 || cleaned.Length > 32) return null;
        return IsAlnum(cleaned) ? cleaned : null;
    }

    /// <summary>Same cleaning as <see cref="NormalizeCode"/>; 0..12 chars ("" allowed). Null when invalid.</summary>
    public static string? NormalizePrefix(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var cleaned = Clean(raw)!;
        if (cleaned.Length > 12) return null;
        return IsAlnum(cleaned) ? cleaned : null;
    }

    /// <summary>prefix + 8 CSPRNG chars from <see cref="LuckySpinRules.CodeAlphabet"/>.</summary>
    public static string GenerateCode(string prefix) =>
        prefix + LuckySpinRules.GenerateCode(GeneratedRandomLength);

    private static string? Clean(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw.Trim().Replace(" ", string.Empty).Replace("-", string.Empty).ToUpperInvariant();
    }

    private static bool IsAlnum(string s)
    {
        foreach (var c in s)
        {
            var ok = (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            if (!ok) return false;
        }
        return true;
    }

    /// <summary>One server-priced cart line (price from Game.SalePrice).</summary>
    public record PricedLine(Guid GameId, string GameName, decimal Price);

    public record CouponTerms(CouponDiscountType Type, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId);

    public record CouponEvaluation(bool Ok, string? ErrorCode, string? Error, decimal Subtotal, decimal ApplicableAmount, decimal DiscountAmount, decimal Total);

    private static decimal Dong(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);

    /// <summary>Validates and normalizes discount terms. Money fields are rounded to whole đồng.</summary>
    public static (CouponTerms? Terms, string? Error) NormalizeTerms(
        CouponDiscountType type, decimal value, decimal? max, decimal? min, Guid? gameId)
    {
        decimal? normMax = null;
        if (type == CouponDiscountType.Percent)
        {
            value = Math.Round(value, 2, MidpointRounding.AwayFromZero);
            if (value <= 0m || value > 100m) return (null, "Phần trăm giảm phải lớn hơn 0 và tối đa 100.");
            if (max.HasValue)
            {
                var m = Dong(max.Value);
                if (m <= 0m) return (null, "Mức giảm tối đa phải lớn hơn 0.");
                normMax = m;
            }
        }
        else
        {
            value = Dong(value);
            if (value < 1m || value > MaxFixedValue) return (null, "Số tiền giảm không hợp lệ.");
        }

        decimal? normMin = null;
        if (min.HasValue)
        {
            var m = Dong(min.Value);
            if (m < 0m || m > MaxFixedValue * 100m) return (null, "Giá trị đơn tối thiểu không hợp lệ.");
            normMin = m == 0m ? null : m;
        }

        var g = gameId == Guid.Empty ? null : gameId;
        return (new CouponTerms(type, value, normMax, normMin, g), null);
    }

    public static CouponTerms TermsOf(Coupon c) =>
        new(c.DiscountType, c.Value, c.MaxDiscountAmount, c.MinOrderAmount, c.GameId);

    /// <summary>
    /// Percent: applicable * Value / 100 (capped by MaxDiscountAmount); Fixed: Value.
    /// Rounded to whole đồng (AwayFromZero), then capped at the applicable amount.
    /// </summary>
    public static decimal ComputeDiscount(CouponTerms t, decimal applicable)
    {
        if (applicable <= 0m) return 0m;
        decimal raw;
        if (t.Type == CouponDiscountType.Percent)
        {
            raw = applicable * t.Value / 100m;
            if (t.MaxDiscountAmount.HasValue && raw > t.MaxDiscountAmount.Value) raw = t.MaxDiscountAmount.Value;
        }
        else
        {
            raw = t.Value;
        }
        var rounded = Dong(raw);
        if (rounded > applicable) rounded = applicable;
        return rounded < 0m ? 0m : rounded;
    }

    private static CouponEvaluation Fail(string code, string error, decimal subtotal) =>
        new(false, code, error, subtotal, 0m, 0m, subtotal);

    /// <summary>Evaluates every rule in order; the first failure wins.</summary>
    public static CouponEvaluation Evaluate(
        Coupon c, string userId, IReadOnlyList<PricedLine> lines, int userActiveRedemptions, DateTime now, string? scopedGameName)
    {
        var subtotal = lines.Sum(l => l.Price);

        if (!c.IsActive) return Fail(ErrInactive, "Mã giảm giá đã bị vô hiệu hóa.", subtotal);
        if (c.StartsAt.HasValue && c.StartsAt.Value > now)
            return Fail(ErrNotStarted, "Mã giảm giá chưa đến thời gian áp dụng.", subtotal);
        if (c.ExpiresAt.HasValue && c.ExpiresAt.Value <= now)
            return Fail(ErrExpired, "Mã giảm giá đã hết hạn.", subtotal);
        if (c.OwnerUserId != null && c.OwnerUserId != userId)
            return Fail(ErrNotOwner, MsgNotOwner, subtotal);
        if (c.MaxTotalUses.HasValue && c.UsedCount >= c.MaxTotalUses.Value)
            return Fail(ErrExhausted, MsgExhausted, subtotal);
        if (userActiveRedemptions >= c.MaxUsesPerCustomer)
            return Fail(ErrUserLimit, MsgUserLimit, subtotal);

        var applicable = c.GameId == null ? subtotal : lines.Where(l => l.GameId == c.GameId.Value).Sum(l => l.Price);
        if (c.GameId != null && applicable == 0m)
            return Fail(ErrGameScope,
                $"Mã chỉ áp dụng cho {scopedGameName ?? "một game khác"} — game này không có trong giỏ hàng.", subtotal);

        if (c.MinOrderAmount.HasValue && applicable < c.MinOrderAmount.Value)
            return Fail(ErrMinOrder,
                $"Đơn hàng cần tối thiểu {FormatVnd(c.MinOrderAmount.Value)} (phần được áp dụng) để dùng mã này.", subtotal);

        var discount = ComputeDiscount(TermsOf(c), applicable);
        if (discount <= 0m) return Fail(ErrNotApplicable, "Mã không áp dụng được cho giỏ hàng này.", subtotal);

        return new CouponEvaluation(true, null, null, subtotal, applicable, discount, subtotal - discount);
    }

    /// <summary>
    /// Builds the SpinReward coupon for a configured Discount prize win (code = reward code).
    /// Null for non-Discount prizes and for legacy Discount prizes without terms.
    /// </summary>
    public static Coupon? TryBuildSpinRewardCoupon(SpinPrize prize, string code, Guid spinId, string? ownerUserId, DateTime now)
    {
        if (prize.Type != SpinPrizeType.Discount) return null;
        if (prize.DiscountType == null || prize.DiscountValue is not > 0m) return null;

        var type = prize.DiscountType.Value;
        var name = string.IsNullOrWhiteSpace(prize.Name) ? "Mã giảm giá vòng quay" : prize.Name.Trim();
        if (name.Length > 100) name = name[..100];

        return new Coupon
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Source = CouponSource.SpinReward,
            DiscountType = type,
            Value = prize.DiscountValue.Value,
            MaxDiscountAmount = type == CouponDiscountType.Percent ? prize.DiscountMaxAmount : null,
            MinOrderAmount = prize.DiscountMinOrderAmount,
            GameId = prize.DiscountGameId,
            StartsAt = null,
            ExpiresAt = now.AddDays(prize.DiscountValidDays ?? DefaultValidDays),
            MaxTotalUses = 1,
            MaxUsesPerCustomer = 1,
            UsedCount = 0,
            IsActive = true,
            OwnerUserId = ownerUserId,
            ClaimedAt = ownerUserId != null ? now : null,
            SpinHistoryId = spinId,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>"1.234.000đ" (vi-VN grouping).</summary>
    public static string FormatVnd(decimal v) =>
        v.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";

    /// <summary>Unspecified → treated as UTC; Local/Utc → converted to UTC.</summary>
    public static DateTime? ToUtc(DateTime? v)
    {
        if (v == null) return null;
        return v.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
            : v.Value.ToUniversalTime();
    }

    public static bool IsTotalExhausted(Coupon c) =>
        c.MaxTotalUses.HasValue && c.UsedCount >= c.MaxTotalUses.Value;

    /// <summary>Wallet status, in precedence order: Inactive, Expired, Used, Upcoming, Usable.</summary>
    public static string WalletStatus(Coupon c, int userActive, DateTime now)
    {
        if (!c.IsActive) return "Inactive";
        if (c.ExpiresAt.HasValue && c.ExpiresAt.Value <= now) return "Expired";
        if (userActive >= c.MaxUsesPerCustomer || IsTotalExhausted(c)) return "Used";
        if (c.StartsAt.HasValue && c.StartsAt.Value > now) return "Upcoming";
        return "Usable";
    }
}
