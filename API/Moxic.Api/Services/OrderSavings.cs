namespace Moxic.Api.Services;

/// <summary>"You saved X vs Xbox Store" figures.</summary>
public static class OrderSavings
{
    /// <summary>Σ max(0, list − paid) over lines + the coupon discount.</summary>
    public static decimal Saved(IEnumerable<(decimal Price, decimal? ListPrice)> lines, decimal discount) =>
        lines.Sum(l => Math.Max(0m, (l.ListPrice ?? l.Price) - l.Price)) + Math.Max(0m, discount);
}
