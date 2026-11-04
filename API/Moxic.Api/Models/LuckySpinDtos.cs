using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

// Public lucky-spin + account points shapes. Probabilities, emails, IPs, user ids and reward codes
// of other people never appear in these records.

/// <summary>A prize as the public sees it (never the probability).</summary>
public record PublicPrizeDto(Guid Id, string Name, SpinPrizeType Type, string Rarity, Guid? GameId, string? ImageUrl);

public record OpenCaseRequest(string? Code);

public record PublicCaseSummaryDto(
    Guid Id,
    string Slug,
    string Name,
    string? Description,
    string? ImageUrl,
    SpinCaseOpenMethod OpenMethod,
    int FreeIntervalHours,
    int PointsCost,
    bool Available,
    int PrizeCount,
    IReadOnlyList<PublicPrizeDto> PreviewPrizes,
    DateTime? NextFreeOpenAt,
    decimal CodePrice = 0);

public record PublicCasesResponse(
    IReadOnlyList<PublicCaseSummaryDto> Items,
    int Total,
    int Page,
    int PageSize,
    bool LoggedIn,
    DateTime ServerNow);

public record CaseViewerDto(
    bool LoggedIn,
    bool EmailVerified,
    int? Points,
    DateTime? NextFreeOpenAt,
    bool CanOpen);

public record PublicCaseDetailDto(
    PublicCaseSummaryDto Case,
    IReadOnlyList<PublicPrizeDto> Prizes,
    CaseViewerDto Viewer,
    DateTime ServerNow);

public record OpenCaseResultDto(
    Guid SpinId,
    string CaseSlug,
    PublicPrizeDto Prize,
    string? RewardCode,
    int? RemainingUses,
    int PointsSpent,
    int? PointsBalance,
    DateTime? NextFreeOpenAt,
    int WinningIndex,
    double StopOffset,
    IReadOnlyList<PublicPrizeDto> Reel,
    bool CouponCreated = false,
    bool CouponInWallet = false,
    DateTime? CouponExpiresAt = null);

public record PublicMusicTrackDto(Guid Id, string Name, string Url);

/// <summary>A real recent win for the LIVE strip. No email, IP, user id or reward code.</summary>
public record LiveDropDto(
    Guid Id,
    string PrizeName,
    SpinPrizeType PrizeType,
    string Rarity,
    string? ImageUrl,
    string CaseName,
    string? CaseSlug,
    string WinnerName,
    DateTime CreatedAt);

public record LiveDropsResponse(IReadOnlyList<LiveDropDto> Wow, IReadOnlyList<LiveDropDto> Feed, DateTime ServerNow);

/// <summary>Customer-facing ledger row (no RefId / CreatedBy).</summary>
public record CustomerPointsTxDto(Guid Id, int Delta, PointsReason Reason, string? Note, int BalanceAfter, DateTime CreatedAt);

public record CustomerPointsResponse(int Balance, IReadOnlyList<CustomerPointsTxDto> Items, int Total, int Page, int PageSize);
