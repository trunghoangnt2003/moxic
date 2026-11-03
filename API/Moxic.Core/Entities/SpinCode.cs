namespace Moxic.Core.Entities;

public class SpinCode
{
    public Guid Id { get; set; }

    /// <summary>Stored UPPERCASE; compared case-insensitively by normalizing input.</summary>
    public string Code { get; set; } = string.Empty;

    public int MaxUses { get; set; } = 1;
    public int UsedCount { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
