using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

// Admin shapes for cases, customers/points and the music library.

public record CaseUpsertRequest(
    string? Name,
    string? Slug,
    string? Description,
    SpinCaseOpenMethod OpenMethod,
    int? FreeIntervalHours,
    int? PointsCost,
    bool IsActive,
    int DisplayOrder,
    decimal? CodePrice = null);

public record AdminCaseDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? ImageUrl,
    SpinCaseOpenMethod OpenMethod,
    int FreeIntervalHours,
    int PointsCost,
    bool IsActive,
    int DisplayOrder,
    int PrizeCount,
    int ActivePrizeCount,
    decimal ActiveTotalPercent,
    bool IsPoolValid,
    int CodeCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    decimal CodePrice = 0);

public record AdminCustomerDto(
    string UserId,
    string Email,
    string DisplayName,
    bool EmailVerified,
    int Points,
    DateTime? CreatedAt,
    bool IsLocked = false);

public record AdminCustomerUpsertRequest(
    string? Email,
    string? DisplayName,
    string? Password,
    bool? EmailVerified);

public record AdminSetPasswordRequest(string? Password);

public record AdminLockRequest(bool Locked);

public record AdminPointsTxDto(
    Guid Id,
    int Delta,
    PointsReason Reason,
    string? RefId,
    string? Note,
    int BalanceAfter,
    string? CreatedBy,
    DateTime CreatedAt);

public record AdjustPointsRequest(int Delta, string? Note);

public record AdminMusicTrackDto(
    Guid Id,
    string Name,
    string Url,
    string ContentType,
    long SizeBytes,
    bool IsActive,
    DateTime CreatedAt);

public record UpdateMusicTrackRequest(string? Name, bool? IsActive);
