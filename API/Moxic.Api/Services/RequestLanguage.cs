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
        _english.Value = header.StartsWith("en", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>The English text on English requests when there is one, otherwise the Vietnamese source.</summary>
    public static string Pick(string vi, string? en) => IsEnglish && !string.IsNullOrWhiteSpace(en) ? en : vi;
}
