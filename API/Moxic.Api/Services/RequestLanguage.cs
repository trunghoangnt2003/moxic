namespace Moxic.Api.Services;

/// <summary>
/// The language of the current request, from Accept-Language (the web sends "vi" or "en").
/// Vietnamese is the source language; English fields fall back to it when empty.
/// </summary>
public static class RequestLanguage
{
    private static readonly AsyncLocal<bool> _english = new();

    public static bool IsEnglish => _english.Value;

    /// <summary>Called once per request by the middleware in Program.cs.</summary>
    public static void Set(HttpContext ctx)
    {
        var header = ctx.Request.Headers.AcceptLanguage.ToString();
        // The web sends exactly "vi" or "en". Browser defaults ("en-US,en;q=0.9") and bots keep Vietnamese,
        // so admins with an English browser still see and edit the source text.
        _english.Value = string.Equals(header.Trim(), "en", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>The English text on English requests when there is one, otherwise the Vietnamese source.</summary>
    public static string Pick(string vi, string? en) => IsEnglish && !string.IsNullOrWhiteSpace(en) ? en : vi;
}
