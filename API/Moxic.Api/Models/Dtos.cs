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
