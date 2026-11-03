using System.Security.Cryptography;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Pure helpers for the lucky spin. All randomness that matters (the winner, codes)
/// comes from <see cref="RandomNumberGenerator"/> (CSPRNG) — never System.Random.
/// </summary>
public static class LuckySpinRules
{
    public const int ReelLength = 50;
    public const int WinningIndex = 44;

    /// <summary>Unambiguous uppercase alphabet (no 0/O/1/I/L).</summary>
    public const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public const string RateLimitPolicy = "lucky-spin";
    public const int SpinCodeLength = 10;
    public const string RewardCodePrefix = "MX";
    public const int RewardCodeRandomLength = 8;
    public const int TotalBasisPoints = 10000;

    public static string GenerateCode(int length) =>
        RandomNumberGenerator.GetString(CodeAlphabet, length);

    public static string GenerateRewardCode() =>
        RewardCodePrefix + GenerateCode(RewardCodeRandomLength);

    /// <summary>Trim, drop spaces and '-', uppercase. Null unless 6..32 chars of A-Z0-9.</summary>
    public static string? NormalizeCode(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var cleaned = raw.Trim().Replace(" ", string.Empty).Replace("-", string.Empty).ToUpperInvariant();
        if (cleaned.Length < 6 || cleaned.Length > 32) return null;
        foreach (var c in cleaned)
        {
            var ok = (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            if (!ok) return null;
        }
        return cleaned;
    }

    public static int ToBasisPoints(decimal percent) => (int)Math.Round(percent * 100m, MidpointRounding.AwayFromZero);

    public static string RarityFor(decimal percent)
    {
        if (percent > 25m) return "common";
        if (percent > 10m) return "uncommon";
        if (percent > 3m) return "rare";
        if (percent > 1m) return "epic";
        return "legendary";
    }

    /// <summary>True when there is at least one active prize and the odds total exactly 100.00%.</summary>
    public static bool IsPoolValid(IReadOnlyCollection<SpinPrize> activePrizes) =>
        activePrizes.Count > 0 && activePrizes.Sum(p => ToBasisPoints(p.Probability)) == TotalBasisPoints;

    /// <summary>CSPRNG weighted draw with a cumulative walk over basis points.</summary>
    public static T PickWeighted<T>(IReadOnlyList<(T Item, int Weight)> entries)
    {
        if (entries.Count == 0) throw new InvalidOperationException("No entries to pick from.");
        var total = 0;
        foreach (var e in entries) total += Math.Max(0, e.Weight);
        if (total <= 0) throw new InvalidOperationException("Total weight must be positive.");

        var roll = RandomNumberGenerator.GetInt32(0, total);
        var cumulative = 0;
        foreach (var e in entries)
        {
            var w = Math.Max(0, e.Weight);
            if (w == 0) continue;
            cumulative += w;
            if (roll < cumulative) return e.Item;
        }
        // Unreachable when weights are positive; defensive fallback.
        return entries[^1].Item;
    }

    public static SpinPrize PickPrize(IReadOnlyList<SpinPrize> activePrizes) =>
        PickWeighted(activePrizes.Select(p => (p, ToBasisPoints(p.Probability))).ToList());

    /// <summary>
    /// Cosmetic reel of <see cref="ReelLength"/> cards sampled by weight; slot
    /// <see cref="WinningIndex"/> is always the server-chosen winner.
    /// </summary>
    public static SpinPrize[] BuildReel(IReadOnlyList<SpinPrize> activePrizes, SpinPrize winner)
    {
        var weighted = activePrizes.Select(p => (p, ToBasisPoints(p.Probability))).ToList();
        var reel = new SpinPrize[ReelLength];
        for (var i = 0; i < ReelLength; i++)
        {
            reel[i] = i == WinningIndex ? winner : PickWeighted(weighted);
        }
        return reel;
    }

    public const string GameBucket = "moxic-games";

    /// <summary>
    /// Presigned cover URL for Game prizes (primary GameMedia, falling back to the first by
    /// display order). Requires Game + Game.Media to be loaded. Null for non-game prizes or on failure.
    /// </summary>
    public static async Task<string?> ResolveImageUrlAsync(IMinioService minio, SpinPrize prize)
    {
        if (prize.Type != SpinPrizeType.Game || prize.Game == null) return null;
        var media = prize.Game.Media.FirstOrDefault(m => m.IsPrimary)
                    ?? prize.Game.Media.OrderBy(m => m.DisplayOrder).FirstOrDefault();
        if (media == null) return null;
        try { return await minio.GetPresignedUrlAsync(GameBucket, media.ObjectKey); } catch { return null; }
    }

    /// <summary>X-Real-IP (set by nginx to $remote_addr) if present, else the socket address.</summary>
    public static string GetClientIp(HttpContext ctx)
    {
        string? ip = null;
        if (ctx.Request.Headers.TryGetValue("X-Real-IP", out var header))
        {
            var value = header.ToString().Trim();
            if (!string.IsNullOrEmpty(value)) ip = value;
        }
        ip ??= ctx.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ip)) ip = "unknown";
        return ip.Length > 64 ? ip[..64] : ip;
    }
}
