using Moxic.Shared.Enums;

namespace Moxic.Api.Models;

public record CreateGameDto
{
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string? Tags { get; init; }
    public GameStatus Status { get; init; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; init; }
    public bool IsFeatured { get; init; }
    public SystemRequirementDataDto? SystemRequirements { get; init; }
    public List<GameRatingDto> Ratings { get; init; } = new();
}

public record UpdateGameDto
{
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string? Tags { get; init; }
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

public record UpdatePaymentConfigDto
{
    public string? TransferSyntaxTemplate { get; init; }
}

public record OrderItemRequest
{
    public Guid GameId { get; init; }
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
}

public record CreateOrderResponse
{
    public Guid Id { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
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
    public decimal TotalAmount { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public PaymentConfigInfo? PaymentConfig { get; init; }
}

public record PaymentConfigInfo
{
    public string TransferSyntaxTemplate { get; init; } = string.Empty;
    public string? BankQrUrl { get; init; }
    public string? CryptoQrUrl { get; init; }
}

// Admin game list response DTOs
public record AdminGameListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string Tags { get; init; } = string.Empty;
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
}

public record AdminGameDetailResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal OriginalPrice { get; init; }
    public decimal SalePrice { get; init; }
    public string Genre { get; init; } = string.Empty;
    public string Tags { get; init; } = string.Empty;
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
    public string CustomerXboxPassword { get; init; } = string.Empty; // decrypted
    public string? CustomerZalo { get; init; }
    public decimal TotalAmount { get; init; }
    public string Status { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public List<AdminOrderDetailItem> Items { get; init; } = new();
    public bool IsClientConfirmed { get; init; }
    public DateTime? ClientConfirmedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record UpdateOrderStatusRequest
{
    public string Status { get; init; } = string.Empty;
}

public record AdminOrderListResponse
{
    public List<AdminOrderListItem> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
