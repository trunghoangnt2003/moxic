namespace Moxic.Core.Entities;

/// <summary>A monthly leaderboard winner (badge + points prize). Unique per (Month, Board, Rank).</summary>
public class LeaderboardAward
{
    public Guid Id { get; set; }

    /// <summary>"2026-11" (Vietnam time).</summary>
    public string Month { get; set; } = string.Empty;

    /// <summary>referrers | reviewers | gamers</summary>
    public string Board { get; set; } = string.Empty;
    public int Rank { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int Score { get; set; }
    public int Points { get; set; }
    public DateTime CreatedAt { get; set; }
}
