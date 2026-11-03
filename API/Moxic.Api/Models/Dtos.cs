using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

public record CreateGameDto
{
    public int RewardPoints { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public List<Guid> GenreIds { get; init; } = new();
    public List<Guid> TagIds { get; init; } = new();
    public GameStatus Status { get; init; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; init; }
    public bool IsFeatured { get; init; }
    public SystemRequirementDataDto? SystemRequirements { get; init; }
    public List<GameRatingDto> Ratings { get; init; } = new();
}

public record UpdateGameDto
{
    public int RewardPoints { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public List<Guid> GenreIds { get; init; } = new();
    public List<Guid> TagIds { get; init; } = new();
    public GameStatus Status { get; init; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; init; }
    public bool IsFeatured { get; init; }
    public SystemRequirementDataDto? SystemRequirements { get; init; }
    public List<GameRatingDto> Ratings { get; init; } = new();
}

public record SystemRequirementDto
{
    public string Os { get; init; } = string.Empty;
    public string Processor { get; init; } = string.Empty;
    public string Memory { get; init; } = string.Empty;
    public string Graphics { get; init; } = string.Empty;
    public string Storage { get; init; } = string.Empty;
}

public record SystemRequirementDataDto
{
    public SystemRequirementDto? Minimum { get; init; }
    public SystemRequirementDto? Recommended { get; init; }
}

public record GameRatingDto
{
    public string Source { get; init; } = string.Empty;
    public double Score { get; init; }
    public double MaxScore { get; init; }
    public string Label { get; init; } = string.Empty;
}

// Genre / Tag DTOs for admin responses
public record GenreAdminDto(Guid Id, string Name);
public record TagAdminDto(Guid Id, string Name);

public record UpdatePaymentConfigDto
{
    public string? TransferSyntaxTemplate { get; init; }
    public string? BankName { get; init; }
    public string? BankAccountNumber { get; init; }
    public string? BankAccountHolder { get; init; }
}

public record OrderItemRequest
{
    public Guid GameId { get; init; }
    /// <summary>Ignored by the server (lines are priced from Game.SalePrice). Kept for client compatibility.</summary>
    public decimal Price { get; init; }
}

public record CreateOrderRequest
{
    public List<OrderItemRequest> Items { get; init; } = new();
    public string CustomerPhone { get; init; } = string.Empty;
    public string CustomerXboxEmail { get; init; } = string.Empty;
    public string CustomerXboxPassword { get; init; } = string.Empty;
    public string? CustomerZalo { get; init; }
    public string PaymentMethod { get; init; } = "Bank";
    /// <summary>Optional coupon (logged-in customers only; one per order).</summary>
    public string? CouponCode { get; init; }
}

public record CreateOrderResponse
{
    public Guid Id { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? CouponCode { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record OrderConfirmationItem
{
    public string GameName { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public record OrderConfirmationResponse
{
    public string OrderCode { get; init; } = string.Empty;
    public List<OrderConfirmationItem> Items { get; init; } = new();
    /// <summary>Amount to transfer (already discounted).</summary>
    public decimal TotalAmount { get; init; }
    /// <summary>TotalAmount + DiscountAmount (sum of line prices).</summary>
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? CouponCode { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public string? PaymentProofUrl { get; init; }
    public PaymentConfigInfo? PaymentConfig { get; init; }
}

public record PaymentConfigInfo
{
    public string TransferSyntaxTemplate { get; init; } = string.Empty;
    public string? BankQrUrl { get; init; }
    public string? CryptoQrUrl { get; init; }
    public string? BankName { get; init; }
    public string? BankAccountNumber { get; init; }
    public string? BankAccountHolder { get; init; }
}

public record PaymentProofUploadResponse
{
    public string OrderCode { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
}

// Admin game list response DTOs
public record AdminGameListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public List<GenreAdminDto> Genres { get; init; } = new();
    public List<TagAdminDto> Tags { get; init; } = new();
    public string Status { get; init; } = string.Empty;
    public DateTime? ReleaseDate { get; init; }
    public int ImageCount { get; init; }
    public string? PrimaryImage { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record AdminGameMediaItem
{
    public Guid Id { get; init; }
    public string ObjectKey { get; init; } = string.Empty;
    public bool IsPrimary { get; init; }
    public int DisplayOrder { get; init; }
    public string? PresignedUrl { get; init; }
    public string MediaType { get; init; } = "image"; // "image" | "video"
}

public record AdminGameDetailResponse
{
    public int RewardPoints { get; init; }
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public List<GenreAdminDto> Genres { get; init; } = new();
    public List<TagAdminDto> Tags { get; init; } = new();
    public string Status { get; init; } = string.Empty;
    public DateTime? ReleaseDate { get; init; }
    public bool IsFeatured { get; init; }
    public SystemRequirementDataDto? SystemRequirements { get; init; }
    public List<GameRatingDto> Ratings { get; init; } = new();
    public List<AdminGameMediaItem> Media { get; init; } = new();
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

// Admin order DTOs
public record AdminOrderListItem
{
    public Guid Id { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public string CustomerPhone { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? CouponCode { get; init; }
    public string Status { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public int ItemCount { get; init; }
    public bool IsPreorder { get; init; }
    public DateTime? ReleaseDate { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record AdminOrderDetailItem
{
    public string GameName { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public record AdminOrderDetailResponse
{
    public Guid Id { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public string CustomerPhone { get; init; } = string.Empty;
    public string CustomerXboxEmail { get; init; } = string.Empty;
    public string CustomerXboxPassword { get; init; } = string.Empty;
    public string? CustomerZalo { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? CouponCode { get; init; }
    public string Status { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public List<AdminOrderDetailItem> Items { get; init; } = new();
    public string? PaymentProofUrl { get; init; }
    public string? CancellationReason { get; init; }
    public bool IsClientConfirmed { get; init; }
    public DateTime? ClientConfirmedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record UpdateOrderStatusRequest
{
    public string Status { get; init; } = string.Empty;
    public string? Reason { get; init; }
}

public record AdminOrderListResponse
{
    public List<AdminOrderListItem> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

