using Moxic.Core.Entities;

namespace Moxic.Api.Services.Catalog;

/// <summary>Selling price from the Xbox VND price: ceil((original × % / 100 + add) / roundTo) × roundTo, never below 0.</summary>
public static class PriceFormula
{
    public static bool IsSet(CatalogSettings? s) => s is { PricePercent: > 0, PriceRoundTo: > 0 };

    public static decimal Compute(decimal original, CatalogSettings? s)
    {
        if (!IsSet(s) || original <= 0) return 0;
        var raw = original * s!.PricePercent / 100m + s.PriceAdd;
        if (raw <= 0) return 0;
        return Math.Ceiling(raw / s.PriceRoundTo) * s.PriceRoundTo;
    }
}
