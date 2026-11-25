namespace Moxic.Core.Entities;

/// <summary>Single-row settings for the Xbox catalog import: the selling-price formula (Id = 1).</summary>
public class CatalogSettings
{
    public int Id { get; set; }
    /// <summary>Selling price = Xbox VND price × PricePercent / 100 + PriceAdd, rounded up to PriceRoundTo.</summary>
    public decimal PricePercent { get; set; }
    public decimal PriceAdd { get; set; }
    public decimal PriceRoundTo { get; set; } = 1000;
    public DateTime UpdatedAt { get; set; }
}
