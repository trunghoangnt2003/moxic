namespace Moxic.Api.Models;

// Request properties are nullable on purpose: missing fields reach our Vietnamese
// validation instead of [ApiController]'s automatic (English) ProblemDetails.

public record RegisterCustomerRequest
{
    public string? Email { get; init; }
    public string? Password { get; init; }
    public string? DisplayName { get; init; }
}

public record VerifyEmailRequest
{
    public string? Email { get; init; }
    public string? Code { get; init; }
}

public record EmailOnlyRequest
{
    public string? Email { get; init; }
}

public record CustomerLoginRequest
{
    public string? Email { get; init; }
    public string? Password { get; init; }
}

public record ResetPasswordRequest
{
    public string? Email { get; init; }
    public string? Code { get; init; }
    public string? NewPassword { get; init; }
}

public record CustomerMeDto(
    string Id,
    string Email,
    string DisplayName,
    int Points,
    bool EmailVerified,
    DateTime CreatedAt);

public record AccountOrderItemDto(
    Guid GameId,
    string GameName,
    decimal Price,
    string? CoverUrl);

public record AccountOrderSummaryDto
{
    public string OrderCode { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    /// <summary>TotalAmount + DiscountAmount.</summary>
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? CouponCode { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public List<AccountOrderItemDto> Items { get; init; } = new();
}

public record AccountOrderDetailDto : AccountOrderSummaryDto
{
    public string XboxEmail { get; init; } = string.Empty;
    public string? CancellationReason { get; init; }
    public bool IsClientConfirmed { get; init; }
    public bool HasPaymentProof { get; init; }
}

public record AccountOrdersResponse(
    List<AccountOrderSummaryDto> Items,
    int Total,
    int Page,
    int PageSize);
