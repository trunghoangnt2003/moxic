namespace Moxic.Core.Entities;

public class GameRating
{
    public string Source { get; set; } = string.Empty;
    public double Score { get; set; }
    public double MaxScore { get; set; }
    public string Label { get; set; } = string.Empty;
}
