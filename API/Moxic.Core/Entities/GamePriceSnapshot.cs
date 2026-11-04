namespace Moxic.Core.Entities;

/// <summary>
/// A recorded price point. Source "Moxic" = our selling price (VND); "XboxStore" = Microsoft Store
/// reference price for <see cref="Region"/> in that region's currency (major units).
/// A new row is written only when the price changes.
/// </summary>
public class GamePriceSnapshot
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public string Source { get; set; } = "Moxic";
    public string Region { get; set; } = "vn";
    public string Currency { get; set; } = "VND";
    public decimal BasePrice { get; set; }
    public decimal SalePrice { get; set; }
    public DateTime CapturedAt { get; set; }
}
