namespace Moxic.Api.Models;

public record ShareSeatDto(
    Guid Id,
    string DisplayName,
    bool IsOwner,
    bool IsMe,
    int Percent,
    decimal ShareAmount,
    decimal DiscountAmount,
    /// <summary>Only on the viewer's own seat.</summary>
    string? CouponCode,
    decimal AmountDue,
    bool Paid,
    DateTime? PaidAt,
    /// <summary>When this unpaid member leaves the room (48h after it filled).</summary>
    DateTime? PayDeadline,
    /// <summary>Completed share purchases (reputation).</summary>
    int ShareCount);

public record ShareMyPaymentDto(
    string? PaymentCode,
    decimal AmountDue,
    decimal PaidAmount,
    bool Paid,
    string? QrUrl,
    string? BankName,
    string? BankAccountNumber,
    string? BankAccountHolder,
    bool AutoConfirm);

public record ShareRoomDto
{
    public string Code { get; init; } = "";
    public Guid GameId { get; init; }
    public string GameName { get; init; } = "";
    public string? CoverUrl { get; set; }
    public decimal TotalPrice { get; init; }
    /// <summary>"Owner" | "Moxic".</summary>
    public string AccountType { get; init; } = "";
    public int OwnerPercent { get; init; }
    public bool IsPublic { get; init; }
    /// <summary>Open | Full | Funded | Cancelled.</summary>
    public string Status { get; init; } = "";
    /// <summary>waiting | paying | full | installing | done | cancelled.</summary>
    public string DisplayStatus { get; init; } = "";
    public bool Locked { get; init; }
    public bool IsMember { get; init; }
    public bool IsOwner { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? FullAt { get; init; }
    public DateTime ExpiresAt { get; init; }
    public List<ShareSeatDto> Seats { get; init; } = new();
    public ShareMyPaymentDto? MyPayment { get; set; }
    /// <summary>Order created once both paid (members only).</summary>
    public string? OrderCode { get; init; }
    public bool OwnerXboxSet { get; init; }
    /// <summary>The owner's own Xbox email (owner only).</summary>
    public string? MyXboxEmail { get; init; }
    public string? CancelReason { get; init; }
    /// <summary>For the viewer's former rooms: why they're no longer in it ("left" | "kicked" | "timeout" | "closed").</summary>
    public string? MyLeftReason { get; init; }
    public bool MyNeedsRefund { get; init; }
    public DateTime? MyRefundedAt { get; init; }
}

public record ShareRoomCardDto(
    string Code,
    Guid GameId,
    string GameName,
    string? CoverUrl,
    string AccountType,
    int OwnerPercent,
    int OpenPercent,
    decimal OpenAmount,
    decimal TotalPrice,
    DateTime ExpiresAt,
    string OwnerName,
    int OwnerShareCount,
    DateTime CreatedAt);

public record ShareMessageDto(Guid Id, string? AuthorName, bool Mine, bool System, string Text, bool Reported, DateTime CreatedAt);

public record CreateShareRoomBody(Guid GameId, Guid? EditionId, string AccountType, int OwnerPercent, bool IsPublic);
public record SharePercentBody(int Percent);
public record ShareCouponBody(string? Code);
public record ShareXboxBody(string? Email, string? Password);
public record ShareMessageBody(string? Text);
public record ProvidedAccountBody(string? Email, string? Password);
public record ShareCloseBody(string? Reason);
