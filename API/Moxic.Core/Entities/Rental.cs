namespace Moxic.Core.Entities;

/// <summary>A rental package for one game, e.g. 7 days for 50.000đ.</summary>
public class RentalPlan
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;
    public int Days { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>A shop-owned Xbox account lent to renters. Each asset serves up to Slots renters at once.</summary>
public class RentalAsset
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string LoginEmail { get; set; } = string.Empty;
    /// <summary>Data-protected password (protector purpose "RentalAssetPassword").</summary>
    public string PasswordEncrypted { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int Slots { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<RentalAssetGame> Games { get; set; } = new List<RentalAssetGame>();
}

public class RentalAssetGame
{
    public Guid AssetId { get; set; }
    public RentalAsset Asset { get; set; } = null!;
    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;
}

public static class RentalStatus
{
    public const string PendingPayment = "PendingPayment";
    public const string AwaitingConfirmation = "AwaitingConfirmation";
    public const string Active = "Active";
    public const string Expired = "Expired";
    public const string Returned = "Returned";
    public const string Completed = "Completed"; // extensions only
    public const string Cancelled = "Cancelled";

    /// <summary>Statuses during which a rental occupies a slot on its asset.</summary>
    public static readonly string[] Occupying = { PendingPayment, AwaitingConfirmation, Active, Expired };
}

/// <summary>A rental (Kind "Rental") or a paid extension of one (Kind "Extension", ParentId set).</summary>
public class RentalOrder
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Kind { get; set; } = "Rental";
    public Guid? ParentId { get; set; }
    public RentalOrder? Parent { get; set; }

    public string CustomerId { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }

    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;
    public string GameName { get; set; } = string.Empty;
    public Guid? PlanId { get; set; }
    public int Days { get; set; }
    public decimal Price { get; set; }

    public string Status { get; set; } = RentalStatus.PendingPayment;
    public Guid? AssetId { get; set; }
    public RentalAsset? Asset { get; set; }

    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? AdminNote { get; set; }
    public string? CancelReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
