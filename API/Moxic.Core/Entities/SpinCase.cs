using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

/// <summary>A lucky-spin case ("hòm") with its own prize pool and open method.</summary>
public class SpinCase
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>English text for /en; empty = use the Vietnamese.</summary>
    public string? NameEn { get; set; }
    public string? DescriptionEn { get; set; }
    public string? ImageObjectKey { get; set; }
    public SpinCaseOpenMethod OpenMethod { get; set; } = SpinCaseOpenMethod.Code;

    /// <summary>FreeInterval only: hours between free opens per account.</summary>
    public int FreeIntervalHours { get; set; } = 24;

    /// <summary>Points only: cost per open.</summary>
    public int PointsCost { get; set; }

    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<SpinPrize> Prizes { get; set; } = new List<SpinPrize>();
}
