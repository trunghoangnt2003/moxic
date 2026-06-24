namespace Moxic.Core.Entities;

public class SystemRequirementData
{
    public SystemRequirement Minimum { get; set; } = new();
    public SystemRequirement Recommended { get; set; } = new();
}

public class SystemRequirement
{
    public string Os { get; set; } = string.Empty;
    public string Processor { get; set; } = string.Empty;
    public string Memory { get; set; } = string.Empty;
    public string Graphics { get; set; } = string.Empty;
    public string Storage { get; set; } = string.Empty;
}
