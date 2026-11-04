using Moxic.Core.Entities;
using Moxic.Core.Interfaces;

namespace Moxic.Api.Services;

public record AnnouncementDto(
    Guid Id,
    string Kind,
    string Title,
    string? Subtitle,
    string? Body,
    string? ImageUrl,
    Guid? GameId,
    string? GameName,
    decimal? GamePrice,
    decimal? GameOriginalPrice,
    DateTime? CountdownTo,
    string? CountdownLabel,
    string? CtaLabel,
    string? CtaUrl,
    DateTime? StartsAt,
    DateTime? EndsAt,
    bool IsActive,
    int Priority,
    bool HasOwnImage,
    DateTime UpdatedAt);

public static class AnnouncementMapper
{
    public static readonly string[] Kinds = { "GameLaunch", "Event", "News" };

    /// <summary>Requires Game + Game.Media loaded when GameId is set.</summary>
    public static async Task<AnnouncementDto> ToDtoAsync(Announcement a, IMinioService minio)
    {
        string? imageUrl = null;
        if (!string.IsNullOrEmpty(a.ImageObjectKey))
        {
            try { imageUrl = await minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, a.ImageObjectKey, 6); } catch { }
        }
        else if (a.Game != null)
        {
            var media = a.Game.Media.FirstOrDefault(m => m.IsPrimary) ?? a.Game.Media.OrderBy(m => m.DisplayOrder).FirstOrDefault();
            if (media != null)
            {
                try { imageUrl = await minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, media.ObjectKey, 6); } catch { }
            }
        }

        var ctaUrl = a.CtaUrl;
        if (string.IsNullOrWhiteSpace(ctaUrl) && a.GameId.HasValue) ctaUrl = $"/games/{a.GameId}";

        return new AnnouncementDto(
            a.Id, a.Kind, RequestLanguage.Pick(a.Title, a.TitleEn), PickOpt(a.Subtitle, a.SubtitleEn), PickOpt(a.Body, a.BodyEn), imageUrl,
            a.GameId, a.Game == null ? null : RequestLanguage.Pick(a.Game.Name, a.Game.NameEn), a.Game?.SalePrice, a.Game?.OriginalPrice,
            a.CountdownTo, PickOpt(a.CountdownLabel, a.CountdownLabelEn), PickOpt(a.CtaLabel, a.CtaLabelEn), ctaUrl,
            a.StartsAt, a.EndsAt, a.IsActive, a.Priority,
            !string.IsNullOrEmpty(a.ImageObjectKey), a.UpdatedAt);
    }

    private static string? PickOpt(string? vi, string? en) => vi == null && string.IsNullOrWhiteSpace(en) ? null : RequestLanguage.Pick(vi ?? "", en);

    /// <summary>Only same-site paths or http(s) URLs may become links.</summary>
    public static bool IsSafeUrl(string url) =>
        (url.StartsWith('/') && !url.StartsWith("//"))
        || (Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp));
}
