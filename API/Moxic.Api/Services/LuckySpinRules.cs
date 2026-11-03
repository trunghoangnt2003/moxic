using System.Globalization;
using System.Net;
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
    public const int ReelLength = 60;
    public const int WinningIndex = 52;

    // Live drops feed
    public const int LiveDropDelaySeconds = 10;
    public const int LiveDropsCacheSeconds = 5;
    public const int LiveFeedSize = 20;
    public const int LiveWowSize = 3;

    /// <summary>Per-user open limit for account cases (FreeInterval / Points), per minute.</summary>
    public const int OpenPerUserPerMinute = 8;

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

    /// <summary>Rarity rank, lower = rarer (same as the storefront RARITY_RANK).</summary>
    public static int RarityRank(string rarity) => rarity switch
    {
        "legendary" => 0,
        "epic" => 1,
        "rare" => 2,
        "uncommon" => 3,
        _ => 4
    };

    /// <summary>
    /// Cosmetic filler weight: roughly uniform across the case's prizes with a bias toward
    /// rarer items, so every prize shows up on the reel. The REAL odds are never used here —
    /// they only drive <see cref="PickPrize"/>.
    /// </summary>
    public static int CosmeticWeight(string rarity) => rarity switch
    {
        "legendary" => 20,
        "epic" => 18,
        "rare" => 15,
        "uncommon" => 12,
        _ => 10
    };

    /// <summary>In-place Fisher-Yates shuffle with the CSPRNG.</summary>
    public static void Shuffle<T>(IList<T> list)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(0, i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    /// <summary>
    /// Server-built reel. <paramref name="StopOffset"/> is a fraction of one card width measured from
    /// the winning card's centre to the point that must end under the marker (positive = toward
    /// WinningIndex + 1). Range [-0.45, 0.45].
    /// </summary>
    public sealed record ReelLayout(SpinPrize[] Cards, int WinningIndex, double StopOffset, bool NearMiss);

    /// <summary>
    /// Cosmetic reel of <see cref="ReelLength"/> cards. Slot <see cref="WinningIndex"/> is always the
    /// server-chosen winner (decided earlier by <see cref="PickPrize"/>). Filler is cosmetic:
    /// (1) every distinct prize is placed at least once before the winner, (2) the rest is sampled by
    /// <see cref="CosmeticWeight"/>, avoiding three identical cards in a row, (3) near-miss: when a
    /// common/uncommon/Luck prize wins, rare-or-better teasers sit at WinningIndex ± 1 and the stop
    /// point lands 5-20% from the edge next to the best teaser.
    /// </summary>
    public static ReelLayout BuildReel(IReadOnlyList<SpinPrize> activePrizes, SpinPrize winner)
    {
        var cards = new SpinPrize?[ReelLength];
        var pool = activePrizes.Count > 0 ? activePrizes : new List<SpinPrize> { winner };

        // (1) coverage pass: each distinct prize once, in a random slot before the winner.
        var distinct = pool.GroupBy(p => p.Id).Select(g => g.First()).ToList();
        Shuffle(distinct);
        var slots = Enumerable.Range(4, Math.Max(0, WinningIndex - 3 - 4 + 1)).ToList();
        Shuffle(slots);
        for (var i = 0; i < distinct.Count && i < slots.Count; i++)
        {
            cards[slots[i]] = distinct[i];
        }

        // (2) cosmetic filler for every other empty slot (except the winning one).
        var weighted = pool.Select(p => (p, CosmeticWeight(RarityFor(p.Probability)))).ToList();
        for (var i = 0; i < ReelLength; i++)
        {
            if (i == WinningIndex || cards[i] != null) continue;
            var pick = PickWeighted(weighted);
            for (var attempt = 0; attempt < 3 && MakesTriple(cards, i, pick); attempt++)
            {
                pick = PickWeighted(weighted);
            }
            cards[i] = pick;
        }

        // (3) the real result.
        cards[WinningIndex] = winner;

        // (4) near-miss teasers around the winner.
        var winnerRank = RarityRank(RarityFor(winner.Probability));
        var teasers = pool
            .Where(p => p.Type != SpinPrizeType.Luck && p.Id != winner.Id)
            .Where(p =>
            {
                var rank = RarityRank(RarityFor(p.Probability));
                return rank <= 2 && rank < winnerRank;
            })
            .ToList();

        var eligible = (winner.Type == SpinPrizeType.Luck || winnerRank >= 3) && teasers.Count > 0;
        double stopOffset;
        if (eligible)
        {
            var bestRank = teasers.Min(p => RarityRank(RarityFor(p.Probability)));
            var best = teasers.Where(p => RarityRank(RarityFor(p.Probability)) == bestRank).ToList();
            var teaserA = best[RandomNumberGenerator.GetInt32(0, best.Count)];
            var side = RandomNumberGenerator.GetInt32(0, 2) == 0 ? -1 : 1;
            cards[WinningIndex + side] = teaserA;
            cards[WinningIndex - side] = teasers[RandomNumberGenerator.GetInt32(0, teasers.Count)];
            // 0.30..0.45 of a card from the centre = 20%..5% of the card width from the edge next to A.
            stopOffset = side * RandomNumberGenerator.GetInt32(300, 451) / 1000.0;
        }
        else
        {
            stopOffset = RandomNumberGenerator.GetInt32(-350, 351) / 1000.0;
        }

        return new ReelLayout(cards.Select(c => c!).ToArray(), WinningIndex, stopOffset, eligible);
    }

    /// <summary>True when placing <paramref name="pick"/> at <paramref name="index"/> creates three identical cards in a row.</summary>
    private static bool MakesTriple(SpinPrize?[] cards, int index, SpinPrize pick)
    {
        bool Same(int i) => i >= 0 && i < cards.Length && cards[i] != null && cards[i]!.Id == pick.Id;
        return (Same(index - 1) && Same(index - 2))
               || (Same(index - 1) && Same(index + 1))
               || (Same(index + 1) && Same(index + 2));
    }

    /// <summary>
    /// Masked public winner name for the live feed: "trung" -> "tr***g", "an" -> "a***".
    /// Uses text elements so Vietnamese diacritics stay intact. Blank -> "Khách".
    /// </summary>
    public static string MaskDisplayName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Khách";
        var trimmed = name.Trim();
        var elements = new List<string>();
        var e = StringInfo.GetTextElementEnumerator(trimmed);
        while (e.MoveNext()) elements.Add(e.GetTextElement());

        if (elements.Count >= 4) return elements[0] + elements[1] + "***" + elements[^1];
        return elements[0] + "***";
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

    /// <summary>
    /// Client IP for rate-limit partitioning. Production chain is Cloudflare -> Caddy -> API:
    /// 1) CF-Connecting-IP (set/overwritten by Cloudflare), 2) the first hop of X-Forwarded-For,
    /// 3) the socket address. Every header value must parse as an IP address.
    /// X-Real-IP is deliberately NOT read: Caddy does not set it, so it would be client-controlled.
    /// Residual risk: requests that reach the origin directly (bypassing Cloudflare) can forge
    /// CF-Connecting-IP — restrict origin ingress to Cloudflare ranges.
    /// </summary>
    public static string GetClientIp(HttpContext ctx)
    {
        string? ip = null;

        if (ctx.Request.Headers.TryGetValue("CF-Connecting-IP", out var cf)
            && IPAddress.TryParse(cf.ToString().Trim(), out var cfIp))
        {
            ip = cfIp.ToString();
        }

        if (ip == null && ctx.Request.Headers.TryGetValue("X-Forwarded-For", out var xff))
        {
            var first = xff.ToString().Split(',')[0].Trim();
            if (IPAddress.TryParse(first, out var xffIp)) ip = xffIp.ToString();
        }

        if (ip == null)
        {
            var remote = ctx.Connection.RemoteIpAddress;
            if (remote != null)
            {
                if (remote.IsIPv4MappedToIPv6) remote = remote.MapToIPv4();
                ip = remote.ToString();
            }
        }

        if (string.IsNullOrEmpty(ip)) ip = "unknown";
        return ip.Length > 64 ? ip[..64] : ip;
    }
}
