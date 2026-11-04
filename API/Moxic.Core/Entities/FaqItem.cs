namespace Moxic.Core.Entities;

/// <summary>Public FAQ entry (shown on /hoi-dap, in FAQPage structured data and in llms.txt). Admin-editable.</summary>
public class FaqItem
{
    public Guid Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
}
