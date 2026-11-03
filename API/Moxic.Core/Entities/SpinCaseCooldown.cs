namespace Moxic.Core.Entities;

/// <summary>Last free open per (customer, case). Composite PK (UserId, CaseId).</summary>
public class SpinCaseCooldown
{
    public string UserId { get; set; } = string.Empty;
    public Guid CaseId { get; set; }
    public DateTime LastOpenedAt { get; set; }
}
