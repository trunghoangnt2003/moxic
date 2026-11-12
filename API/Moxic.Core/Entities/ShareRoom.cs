namespace Moxic.Core.Entities;

/// <summary>
/// A share room: up to 2 customers buy one game together. Each pays their own seat by bank transfer;
/// once both seats are paid one <see cref="Order"/> is created (OrderId) and fulfilled like any other.
/// </summary>
public class ShareRoom
{
    public Guid Id { get; set; }
    /// <summary>6-character room code (also the link /share/{Code}).</summary>
    public string Code { get; set; } = string.Empty;
    public Guid GameId { get; set; }
    public Guid? EditionId { get; set; }
    /// <summary>Snapshot of the game (+ edition) name at creation.</summary>
    public string GameName { get; set; } = string.Empty;
    /// <summary>Game price snapshot at creation; the two seats always sum to this.</summary>
    public decimal TotalPrice { get; set; }
    /// <summary>"Owner" (room owner's Xbox account) | "Moxic" (account provided by Moxic).</summary>
    public string AccountType { get; set; } = "Owner";
    public int OwnerPercent { get; set; } = 50;
    public bool IsPublic { get; set; } = true;
    /// <summary>"Open" (waiting for a partner) | "Full" (2 members, paying) | "Funded" (both paid, order created) | "Cancelled".</summary>
    public string Status { get; set; } = "Open";
    public string OwnerUserId { get; set; } = string.Empty;
    /// <summary>Set once anyone has paid: percent, account type and game can no longer change.</summary>
    public bool Locked { get; set; }
    public Guid? OrderId { get; set; }
    public string? CancelReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>When the room last became full (the 48h payment window starts here).</summary>
    public DateTime? FullAt { get; set; }
    public DateTime? FundedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public ICollection<ShareSeat> Seats { get; set; } = new List<ShareSeat>();
}

/// <summary>A member's place in a room. "In the room" = LeftAt is null.</summary>
public class ShareSeat
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public ShareRoom? Room { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsOwner { get; set; }
    public int Percent { get; set; }
    public decimal ShareAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public Guid? CouponId { get; set; }
    public string? CouponCode { get; set; }
    /// <summary>ShareAmount - DiscountAmount: what this member transfers.</summary>
    public decimal AmountDue { get; set; }
    /// <summary>Transfer content for this seat ("MXR" + 8), unique.</summary>
    public string? PaymentCode { get; set; }
    public decimal PaidAmount { get; set; }
    public DateTime? PaidAt { get; set; }
    /// <summary>Owner seat of an "Owner" room: the Xbox account the game is installed on.</summary>
    public string? XboxEmail { get; set; }
    public string? XboxPasswordEncrypted { get; set; }
    /// <summary>"vi" | "en" — language for this member's emails.</summary>
    public string Lang { get; set; } = "vi";
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    /// <summary>"left" | "kicked" | "timeout" | "closed".</summary>
    public string? LeftReason { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    /// <summary>Money was received for this seat but the room will not go ahead: an admin refunds by hand.</summary>
    public bool NeedsRefund { get; set; }
    public DateTime? RefundedAt { get; set; }
}

/// <summary>Room discussion message. UserId null = system message (Text vi, TextEn en).</summary>
public class ShareMessage
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string? UserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? TextEn { get; set; }
    public bool Reported { get; set; }
    public DateTime CreatedAt { get; set; }
}
