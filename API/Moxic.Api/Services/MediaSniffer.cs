namespace Moxic.Api.Services;

/// <summary>
/// Magic-byte checks for admin uploads (case images, music). Uploads always use the
/// server-chosen <see cref="ContentTypeFor"/>, never the client-supplied Content-Type.
/// </summary>
public static class MediaSniffer
{
    public static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    public static readonly string[] AudioExtensions = [".mp3", ".ogg", ".m4a"];

    /// <summary>JPEG FF D8 FF, PNG 89 50 4E 47, WEBP "RIFF" .... "WEBP" — must also match the extension.</summary>
    public static bool IsImage(Stream stream, string ext)
    {
        var h = ReadHeader(stream);
        if (h.Length < 12) return false;
        return ext switch
        {
            ".jpg" or ".jpeg" => h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF,
            ".png" => h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47,
            ".webp" => Ascii(h, 0, "RIFF") && Ascii(h, 8, "WEBP"),
            _ => false
        };
    }

    /// <summary>mp3 "ID3" or an MPEG frame sync, ogg "OggS", m4a "ftyp" at offset 4.</summary>
    public static bool IsAudio(Stream stream, string ext)
    {
        var h = ReadHeader(stream);
        if (h.Length < 12) return false;
        return ext switch
        {
            ".mp3" => Ascii(h, 0, "ID3") || (h[0] == 0xFF && (h[1] & 0xE0) == 0xE0),
            ".ogg" => Ascii(h, 0, "OggS"),
            ".m4a" => Ascii(h, 4, "ftyp"),
            _ => false
        };
    }

    public static string? ContentTypeFor(string ext) => ext switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".mp3" => "audio/mpeg",
        ".ogg" => "audio/ogg",
        ".m4a" => "audio/mp4",
        _ => null
    };

    private static byte[] ReadHeader(Stream stream)
    {
        var buffer = new byte[12];
        var read = 0;
        while (read < buffer.Length)
        {
            var n = stream.Read(buffer, read, buffer.Length - read);
            if (n == 0) break;
            read += n;
        }
        return read == buffer.Length ? buffer : buffer[..read];
    }

    private static bool Ascii(byte[] h, int offset, string text)
    {
        if (offset + text.Length > h.Length) return false;
        for (var i = 0; i < text.Length; i++)
        {
            if (h[offset + i] != (byte)text[i]) return false;
        }
        return true;
    }
}
