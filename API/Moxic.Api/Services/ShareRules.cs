using System.Text.RegularExpressions;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>Pure rules for share rooms (2 people buy one game together): money split, codes, deadlines, display status.</summary>
public static class ShareRules
{
    public const int MaxSeats = 2;
    public const int MaxOpenRoomsPerUser = 3;
    public const int MinPercent = 10;
    public const int MaxPercent = 90;
    public const int RoomCodeLength = 6;
    public const string PaymentPrefix = "MXR";
    public static readonly TimeSpan PayWindow = TimeSpan.FromHours(48);
    public static readonly TimeSpan ReminderAfter = TimeSpan.FromHours(36);
    public static readonly TimeSpan RoomLifetime = TimeSpan.FromDays(7);

    private static readonly Regex CodeInContent = new(@"MXR([A-Z0-9]{8})", RegexOptions.Compiled);

    public static bool IsValidPercent(int p) => p >= MinPercent && p <= MaxPercent && p % 5 == 0;

    /// <summary>Owner/partner amounts: the partner's part is rounded down to 1.000đ, the owner takes the rest, so they always sum to the total.</summary>
    public static (decimal Owner, decimal Partner) Split(decimal total, int ownerPercent)
    {
        var partner = Math.Floor(total * (100 - ownerPercent) / 100m / 1000m) * 1000m;
        return (total - partner, partner);
    }

    /// <summary>The seat payment code in a bank transfer's content, e.g. "MXR8F3K2Q1X".</summary>
    public static string? FindPaymentCode(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var normalized = Regex.Replace(content.ToUpperInvariant(), "[^A-Z0-9]", "");
        var m = CodeInContent.Match(normalized);
        return m.Success ? PaymentPrefix + m.Groups[1].Value : null;
    }

    public static string NewPaymentCode() => PaymentPrefix + LuckySpinRules.GenerateCode(8);
    public static string NewRoomCode() => LuckySpinRules.GenerateCode(RoomCodeLength);

    /// <summary>waiting | paying | full | installing | done | cancelled (chờ người / chờ thanh toán / đã đủ / đang cài / hoàn tất / đã hủy).</summary>
    public static string DisplayStatus(string roomStatus, OrderStatus? orderStatus) => roomStatus switch
    {
        "Open" => "waiting",
        "Full" => "paying",
        "Cancelled" => "cancelled",
        "Funded" => orderStatus switch
        {
            OrderStatus.Installing or OrderStatus.ActionRequired => "installing",
            OrderStatus.Completed => "done",
            OrderStatus.Cancelled => "cancelled",
            _ => "full",
        },
        _ => "waiting",
    };

    public static DateTime PayDeadline(DateTime fullAt) => fullAt + PayWindow;
    public static DateTime ReminderAt(DateTime fullAt) => fullAt + ReminderAfter;
    public static DateTime RoomExpiry(DateTime createdAt) => createdAt + RoomLifetime;
}
