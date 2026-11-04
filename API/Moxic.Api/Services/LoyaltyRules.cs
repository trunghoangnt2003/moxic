namespace Moxic.Api.Services;

public record LoyaltyTier(string Key, string Name, decimal MinSpent, decimal PointsMultiplier, int CheckInBonus, string Perk);

public record LoyaltyMission(string Key, string Title, string Description, int Points, string? Link);

/// <summary>Membership program constants: tiers by lifetime spend, check-in rewards, missions, referral.</summary>
public static class LoyaltyRules
{
    public static readonly LoyaltyTier[] Tiers =
    {
        new("member", "Thành viên", 0m, 1.00m, 0, "Tích điểm khi mua game"),
        new("silver", "Bạc", 1_000_000m, 1.10m, 2, "+10% điểm mỗi đơn · +2 điểm điểm danh"),
        new("gold", "Vàng", 3_000_000m, 1.25m, 5, "+25% điểm mỗi đơn · +5 điểm điểm danh"),
        new("diamond", "Kim cương", 10_000_000m, 1.50m, 10, "+50% điểm mỗi đơn · +10 điểm điểm danh · hỗ trợ ưu tiên"),
    };

    public static LoyaltyTier TierFor(decimal spent) => Tiers.Last(t => spent >= t.MinSpent);
    public static LoyaltyTier? NextTier(decimal spent) => Tiers.FirstOrDefault(t => t.MinSpent > spent);

    /// <summary>Base points per check-in; day 7 of a streak (and every 7th) pays the weekly bonus instead.</summary>
    public const int CheckInPoints = 5;
    public const int WeeklyStreakBonus = 50;

    public static int CheckInReward(int streakDay, LoyaltyTier tier) =>
        (streakDay % 7 == 0 ? WeeklyStreakBonus : CheckInPoints) + tier.CheckInBonus;

    public static readonly LoyaltyMission[] Missions =
    {
        new("verify_email", "Xác minh email", "Hoàn tất xác minh tài khoản", 20, null),
        new("first_wishlist", "Thêm game yêu thích", "Thêm 1 game vào danh sách Yêu thích", 10, "/games"),
        new("first_case", "Mở hòm đầu tiên", "Mở bất kỳ hòm may mắn nào", 10, "/lucky-spin"),
        new("first_review", "Viết đánh giá", "Đánh giá một game trên Moxic", 30, "/games"),
        new("first_purchase", "Đơn hàng đầu tiên", "Hoàn tất một đơn mua game", 100, "/games"),
        new("first_rental", "Thuê game lần đầu", "Thuê thành công một game", 50, "/rent"),
    };

    /// <summary>Referral rewards, paid when the referee's first order completes.</summary>
    public const int ReferrerReward = 200;
    public const int RefereeReward = 100;
    /// <summary>How long after sign-up a customer may still enter a referral code.</summary>
    public static readonly TimeSpan ReferralWindow = TimeSpan.FromDays(14);

    public static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);
    public static DateTime VnToday() => (DateTime.UtcNow + VnOffset).Date;
}
