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
