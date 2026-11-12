using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Share-room side effects: bell (+ push) and email for members in each member's language, Telegram for admins.
/// Never throws — a failed notification must not undo a saved room change.
/// </summary>
public class ShareNotifier : IShareEvents
{
    private readonly MoxicDbContext _db;
    private readonly NotificationService _notifications;
    private readonly IBackgroundEmailQueue _emails;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ShareNotifier> _logger;
    private readonly string _site;

    public ShareNotifier(MoxicDbContext db, NotificationService notifications, IBackgroundEmailQueue emails, IServiceScopeFactory scopes,
        IConfiguration config, ILogger<ShareNotifier> logger)
    {
        _db = db;
        _notifications = notifications;
        _emails = emails;
        _scopes = scopes;
        _logger = logger;
        _site = (config["Site:BaseUrl"] ?? "https://moxic.co").TrimEnd('/');
    }

    private static string Vnd(decimal v) => ShareRoomService.Vnd(v);
    private string Link(ShareRoom r, ShareSeat s) => $"{_site}{(s.Lang == "en" ? "/en" : "")}/share/{r.Code}";

    /// <summary>Bell + email to one member. Texts are (vi, en) pairs; the member's language picks one.</summary>
    private async Task TellAsync(ShareRoom room, ShareSeat seat, (string Vi, string En) title, (string Vi, string En) body, bool email = true)
    {
        try
        {
            var en = seat.Lang == "en";
            await _notifications.AddAsync(seat.UserId, "share", en ? title.En : title.Vi, en ? body.En : body.Vi, $"/share/{room.Code}");
            if (!email) return;
            var to = await _db.Users.AsNoTracking().Where(u => u.Id == seat.UserId).Select(u => u.Email).FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(to)) return;
            var t = en ? title.En : title.Vi;
            var b = en ? body.En : body.Vi;
            var link = Link(room, seat);
            var open = en ? $"Open the room: {link}" : $"Mở phòng: {link}";
            _emails.Enqueue(async (sf, ct) =>
            {
                using var scope = sf.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IEmailService>().SendNoticeAsync(to, t, t, b, open);
            });
        }
        catch (Exception e)
        {
            _logger.LogWarning(e, "Share notification failed for room {Room}", room.Code);
        }
    }

    private static IEnumerable<ShareSeat> Active(ShareRoom r) => r.Seats.Where(s => s.LeftAt == null);
    private void Admin(string html) => TelegramOrderNotifier.TextInBackground(_scopes, html, _logger);

    public async Task MemberJoined(ShareRoom room, ShareSeat seat)
    {
        foreach (var s in Active(room).Where(s => s.Id != seat.Id))
            await TellAsync(room, s,
                ($"🤝 {seat.DisplayName} đã vào phòng share {room.GameName}", $"🤝 {seat.DisplayName} joined your share room for {room.GameName}"),
                ("Thảo luận trong phòng để chốt cách chơi, rồi thanh toán phần của bạn.", "Agree on who plays how in the room chat, then pay your part."),
                email: false);
    }

    public async Task RoomFull(ShareRoom room)
    {
        foreach (var s in Active(room))
            await TellAsync(room, s,
                ($"Phòng share {room.GameName} đã đủ 2 người", $"Your share room for {room.GameName} is full"),
                ($"Bạn có thể thanh toán phần của mình ({Vnd(s.AmountDue)}) ngay bây giờ. Mỗi người có 48 giờ để thanh toán.",
                 $"You can pay your part ({Vnd(s.AmountDue)}) now. Each member has 48 hours to pay."));
    }

    public async Task SeatPaid(ShareRoom room, ShareSeat seat)
    {
        foreach (var s in Active(room).Where(s => s.Id != seat.Id && s.PaidAt == null))
            await TellAsync(room, s,
                ($"{seat.DisplayName} đã thanh toán phần của mình", $"{seat.DisplayName} paid their part"),
                ($"Còn phần của bạn ({Vnd(s.AmountDue)}). Thanh toán xong là Moxic cài game cho cả hai.",
                 $"Only your part is left ({Vnd(s.AmountDue)}). Once paid, Moxic installs the game for you both."));
    }

    public async Task RoomFunded(ShareRoom room, Order order)
    {
        foreach (var s in Active(room))
            await TellAsync(room, s,
                ($"Cả hai đã thanh toán · đơn {order.OrderCode}", $"Both paid · order {order.OrderCode}"),
                ($"Moxic đang xác minh và chuẩn bị cài {room.GameName}. Bạn theo dõi tiến trình trong Tài khoản → Đơn hàng.",
                 $"Moxic is verifying and getting ready to install {room.GameName}. Follow it in Account → Orders."));
        TelegramOrderNotifier.NotifyInBackground(_scopes, order.Id,
            $"🤝 Phòng share {room.Code} đã đủ tiền ({Vnd(order.TotalAmount)}) — cần cài game · " +
            (room.AccountType == "Owner" ? "tài khoản chủ phòng" : $"TÀI KHOẢN MOXIC CẤP — gửi /tk {order.OrderCode} email mật_khẩu"),
            log: _logger);
    }

    public Task PayReminder(ShareRoom room, ShareSeat seat) =>
        TellAsync(room, seat,
            ("⏰ Còn 12 giờ để thanh toán phần share", "⏰ 12 hours left to pay your share"),
            ($"Phần của bạn trong phòng {room.GameName} là {Vnd(seat.AmountDue)}. Quá hạn bạn sẽ rời phòng để nhường chỗ cho người khác.",
             $"Your part for {room.GameName} is {Vnd(seat.AmountDue)}. After the deadline you'll leave the room so someone else can join."));

    public async Task SeatRemoved(ShareRoom room, ShareSeat seat, string reason)
    {
        if (reason != "left")
            await TellAsync(room, seat,
                reason == "timeout"
                    ? ("Bạn đã rời phòng share vì quá hạn thanh toán", "You left the share room — payment deadline passed")
                    : ("Chủ phòng đã mời bạn ra khỏi phòng share", "The owner removed you from the share room"),
                ($"Phòng {room.GameName}. Bạn có thể tìm phòng khác trên Moxic.", $"Room for {room.GameName}. You can find another room on Moxic."));
        foreach (var s in Active(room))
            await TellAsync(room, s,
                ($"{seat.DisplayName} đã rời phòng share", $"{seat.DisplayName} left the share room"),
                ("Phòng đã mở lại để tìm người share mới.", "The room is open again for a new partner."), email: s.PaidAt != null);
    }

    public async Task RoomCancelled(ShareRoom room)
    {
        var refunds = room.Seats.Where(s => s.NeedsRefund && s.RefundedAt == null).ToList();
        foreach (var s in room.Seats.Where(s => s.LeftReason == "closed"))
            await TellAsync(room, s,
                ($"Phòng share {room.GameName} đã đóng", $"The share room for {room.GameName} is closed"),
                s.NeedsRefund
                    ? ($"Moxic sẽ hoàn lại {Vnd(s.PaidAmount)} cho bạn. Hãy nhắn hỗ trợ số tài khoản nhận tiền.",
                       $"Moxic will refund {Vnd(s.PaidAmount)}. Please send us the bank account to refund to via support chat.")
                    : ("Bạn có thể tạo phòng mới hoặc tìm phòng khác.", "You can open a new room or find another one."));
        if (refunds.Count > 0)
            Admin($"💸 <b>Cần hoàn tiền share</b> · phòng <code>{room.Code}</code> ({TelegramBot.Html(room.GameName)}) đã đóng ({TelegramBot.Html(room.CancelReason)})\n" +
                  string.Join("\n", refunds.Select(s => $"• {TelegramBot.Html(s.DisplayName)}: {Vnd(s.PaidAmount)} (mã {s.PaymentCode})")) +
                  "\nAdmin → Phòng share → Cần hoàn tiền.");
    }

    public Task Refunded(ShareRoom room, ShareSeat seat) =>
        TellAsync(room, seat,
            ($"Moxic đã hoàn {Vnd(seat.PaidAmount)} phần share", $"Moxic refunded {Vnd(seat.PaidAmount)} for your share"),
            ($"Khoản thanh toán cho phòng {room.GameName} đã được hoàn lại.", $"Your payment for the {room.GameName} room has been refunded."));

    public Task MessageReported(ShareRoom room, ShareMessage message)
    {
        Admin($"🚩 <b>Tin nhắn phòng share bị báo cáo</b> · phòng <code>{room.Code}</code>\n<i>{TelegramBot.Html(message.Text)}</i>");
        return Task.CompletedTask;
    }

    public Task TransferProblem(string html)
    {
        Admin(html);
        return Task.CompletedTask;
    }
}
