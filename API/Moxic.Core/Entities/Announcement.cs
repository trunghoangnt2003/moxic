namespace Moxic.Core.Entities;

/// <summary>
/// Storefront pop-up announcement shown when a visitor opens the site: an upcoming blockbuster
/// (optionally linked to a store game, with a release countdown) or an upcoming event.
/// </summary>
public class Announcement
{
    public Guid Id { get; set; }

    /// <summary>"GameLaunch" | "Event" | "News" — drives the badge and accent colour.</summary>
    public string Kind { get; set; } = "GameLaunch";

    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? Body { get; set; }
    /// <summary>English text for /en; empty = use the Vietnamese.</summary>
    public string? TitleEn { get; set; }
    public string? SubtitleEn { get; set; }
    public string? BodyEn { get; set; }
    public string? CountdownLabelEn { get; set; }
    public string? CtaLabelEn { get; set; }

    /// <summary>Banner image in MinIO. When empty and GameId is set, the game's cover is used.</summary>
    public string? ImageObjectKey { get; set; }
    public Guid? GameId { get; set; }
    public Game? Game { get; set; }

    /// <summary>Target time for the countdown (release date / event start). Null = no countdown.</summary>
    public DateTime? CountdownTo { get; set; }
    public string? CountdownLabel { get; set; }

    public string? CtaLabel { get; set; }
    /// <summary>Relative path ("/games/…", "/lucky-spin") or absolute https URL. Defaults to the game page.</summary>
    public string? CtaUrl { get; set; }

    /// <summary>Visibility window; null = unbounded.</summary>
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; } = true;
    /// <summary>Higher shows first.</summary>
    public int Priority { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
