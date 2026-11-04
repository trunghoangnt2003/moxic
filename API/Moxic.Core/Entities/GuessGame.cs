namespace Moxic.Core.Entities;

/// <summary>The daily "Đoán game" puzzle — picked automatically on the first request of each Vietnam day.</summary>
public class GuessPuzzle
{
    /// <summary>"yyyy-MM-dd" (Vietnam date). Primary key.</summary>
    public string Date { get; set; } = string.Empty;
    public Guid GameId { get; set; }

    /// <summary>MinIO object key of the picture to guess (a screenshot when available — covers show the title).</summary>
    public string ObjectKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>One player's attempt at one day's puzzle (customer account, or an anonymous browser key).</summary>
public class GuessPlay
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;

    /// <summary>"u:{userId}" or "g:{sha256 of browser key}".</summary>
    public string PlayerKey { get; set; } = string.Empty;
    public string? UserId { get; set; }

    /// <summary>Comma-separated guessed game ids, in order.</summary>
    public string Guesses { get; set; } = string.Empty;
    public int Tries { get; set; }
    public bool Solved { get; set; }
    public bool Finished { get; set; }
    public int Points { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
