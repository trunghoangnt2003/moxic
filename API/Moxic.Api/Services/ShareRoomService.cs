using System.Globalization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;
using static Moxic.Api.Services.CouponRules;

namespace Moxic.Api.Services;

public record CreateShareRoomRequest(Guid GameId, Guid? EditionId, string AccountType, int OwnerPercent, bool IsPublic);

/// <summary>Side effects of room changes (bell, email, Telegram). Called after the change is saved; must not throw.</summary>
public interface IShareEvents
{
    Task MemberJoined(ShareRoom room, ShareSeat seat);
    Task RoomFull(ShareRoom room);
    Task SeatPaid(ShareRoom room, ShareSeat seat);
    Task RoomFunded(ShareRoom room, Order order);
    Task PayReminder(ShareRoom room, ShareSeat seat);
    Task SeatRemoved(ShareRoom room, ShareSeat seat, string reason);
    Task RoomCancelled(ShareRoom room);
    Task Refunded(ShareRoom room, ShareSeat seat);
    Task MessageReported(ShareRoom room, ShareMessage message);
    /// <summary>Money that needs an admin's eye (unknown code, underpaid, paid to a closed room…), as Telegram HTML.</summary>
    Task TransferProblem(string html);
}

/// <summary>
/// Share rooms: 2 customers buy one game together, each pays their own seat (transfer content MXR…);
/// when both seats are paid one order is created and fulfilled like any other order.
/// Every method returns a localized error instead of throwing for rule violations.
/// </summary>
public class ShareRoomService
{
    public const string ProtectorPurpose = "XboxPassword";
    private const int MaxMessagesPerMinute = 20;
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    private readonly MoxicDbContext _db;
    private readonly CouponService _coupons;
    private readonly IDataProtector _protector;
    private readonly IShareEvents _events;
    private readonly ILogger<ShareRoomService> _logger;

    public ShareRoomService(MoxicDbContext db, CouponService coupons, IDataProtectionProvider dp, IShareEvents events, ILogger<ShareRoomService> logger)
    {
        _db = db;
        _coupons = coupons;
        _protector = dp.CreateProtector(ProtectorPurpose);
        _events = events;
        _logger = logger;
    }

    public static string Vnd(decimal v) => v.ToString("N0", Vi) + "đ";
    private static string T(string vi, string en) => RequestLanguage.T(vi, en);
    private static IEnumerable<ShareSeat> Active(ShareRoom r) => r.Seats.Where(s => s.LeftAt == null);

    public Task<ShareRoom?> LoadAsync(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        return _db.ShareRooms.Include(r => r.Seats).FirstOrDefaultAsync(r => r.Code == c);
    }

    private Task<int> OpenRoomCountAsync(string userId) =>
        _db.ShareSeats.CountAsync(s => s.UserId == userId && s.LeftAt == null && (s.Room!.Status == "Open" || s.Room.Status == "Full"));

    private async Task<string> LangOfAsync(string userId) =>
        await _db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == userId).Select(p => p.Lang).FirstOrDefaultAsync() ?? "vi";

    private void System(ShareRoom room, string vi, string en) =>
        _db.ShareMessages.Add(new ShareMessage { Id = Guid.NewGuid(), RoomId = room.Id, Text = vi, TextEn = en, CreatedAt = DateTime.UtcNow });

    private static string TooMany() => T($"Bạn đang có {ShareRules.MaxOpenRoomsPerUser} phòng share đang mở. Hãy hoàn tất hoặc rời bớt phòng.",
        $"You already have {ShareRules.MaxOpenRoomsPerUser} open share rooms. Finish or leave one first.");
    private static string NotFound() => T("Không tìm thấy phòng share.", "Share room not found.");

    // ───────────────────────── create / join / leave ─────────────────────────

    public async Task<(ShareRoom? Room, string? Error)> CreateAsync(CustomerIdentity who, CreateShareRoomRequest req)
    {
        if (!ShareRules.IsValidPercent(req.OwnerPercent))
            return (null, T("Tỷ lệ phải từ 10% đến 90%, bước 5%.", "The split must be 10–90% in steps of 5%."));
        if (req.AccountType is not ("Owner" or "Moxic"))
            return (null, T("Kiểu tài khoản không hợp lệ.", "Invalid account type."));
        var allow = await _db.Games.AsNoTracking().Where(g => g.Id == req.GameId).Select(g => (bool?)g.AllowShare).FirstOrDefaultAsync();
        if (allow != true) return (null, T("Game này chưa mở share.", "This game can't be shared."));
        if (await OpenRoomCountAsync(who.UserId) >= ShareRules.MaxOpenRoomsPerUser) return (null, TooMany());

        var (lines, priceErr) = await _coupons.PriceLinesAsync(new[] { (req.GameId, req.EditionId) });
        if (lines == null || lines.Count != 1) return (null, priceErr ?? NotFound());
        var line = lines[0];

        string code;
        do code = ShareRules.NewRoomCode();
        while (await _db.ShareRooms.AnyAsync(r => r.Code == code));

        var now = DateTime.UtcNow;
        var (ownerAmount, _) = ShareRules.Split(line.Price, req.OwnerPercent);
        var room = new ShareRoom
        {
            Id = Guid.NewGuid(), Code = code, GameId = req.GameId, EditionId = req.EditionId, GameName = line.GameName,
            TotalPrice = line.Price, AccountType = req.AccountType, OwnerPercent = req.OwnerPercent, IsPublic = req.IsPublic,
            Status = "Open", OwnerUserId = who.UserId, CreatedAt = now, UpdatedAt = now,
        };
        room.Seats.Add(new ShareSeat
        {
            Id = Guid.NewGuid(), RoomId = room.Id, UserId = who.UserId, DisplayName = Cut(who.DisplayName, 100), IsOwner = true,
            Percent = req.OwnerPercent, ShareAmount = ownerAmount, AmountDue = ownerAmount, Lang = await LangOfAsync(who.UserId), JoinedAt = now,
        });
        _db.ShareRooms.Add(room);
        System(room, $"{who.DisplayName} đã tạo phòng", $"{who.DisplayName} created the room");
        await _db.SaveChangesAsync();
        _logger.LogInformation("Share room {Code} created by {User} for {Game} ({Total})", code, who.UserId, line.GameName, line.Price);
        return (room, null);
    }

    public async Task<(ShareRoom? Room, string? Error)> JoinAsync(string code, CustomerIdentity who)
    {
        var room = await LoadAsync(code);
        if (room == null) return (null, NotFound());
        if (Active(room).Any(s => s.UserId == who.UserId)) return (null, T("Bạn đã ở trong phòng này.", "You're already in this room."));
        if (room.Status != "Open") return (null, T("Phòng đã đủ người hoặc đã đóng.", "This room is full or closed."));
        if (await OpenRoomCountAsync(who.UserId) >= ShareRules.MaxOpenRoomsPerUser) return (null, TooMany());

        // Claim the empty seat atomically: concurrent joiners serialize on the row, only one sees Status = 'Open'.
        var now = DateTime.UtcNow;
        var claimed = await _db.ShareRooms.Where(r => r.Id == room.Id && r.Status == "Open")
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Full").SetProperty(r => r.FullAt, now).SetProperty(r => r.UpdatedAt, now));
        if (claimed != 1) return (null, T("Phòng vừa có người khác vào.", "Someone else just took this seat."));
        room.Status = "Full";
        room.FullAt = now;
        room.UpdatedAt = now;

        var owner = Active(room).Single(s => s.IsOwner);
        var share = room.TotalPrice - owner.ShareAmount;
        var seat = new ShareSeat
        {
            Id = Guid.NewGuid(), RoomId = room.Id, UserId = who.UserId, DisplayName = Cut(who.DisplayName, 100),
            Percent = 100 - owner.Percent, ShareAmount = share, AmountDue = share, Lang = await LangOfAsync(who.UserId), JoinedAt = now,
        };
        _db.ShareSeats.Add(seat);
        System(room, $"{who.DisplayName} đã vào phòng · phòng đã đủ 2 người", $"{who.DisplayName} joined · the room is full");
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException e)
        {
            _logger.LogWarning(e, "Join of share room {Code} failed after claim", room.Code);
            await _db.ShareRooms.Where(r => r.Id == room.Id && r.Status == "Full")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Open").SetProperty(r => r.FullAt, (DateTime?)null));
            return (null, T("Không vào được phòng, thử lại nhé.", "Couldn't join the room, please try again."));
        }
        await _events.MemberJoined(room, seat);
        await _events.RoomFull(room);
        return (room, null);
    }

    public async Task<(ShareRoom? Room, string? Error)> LeaveAsync(string code, string userId)
    {
        var room = await LoadAsync(code);
        var seat = room == null ? null : Active(room).FirstOrDefault(s => s.UserId == userId);
        if (room == null || seat == null) return (null, NotFound());
        if (room.Status is not ("Open" or "Full")) return (null, T("Phòng đã chốt, không thể rời.", "This room is settled, you can't leave."));
        if (seat.PaidAmount > 0) return (null, T("Bạn đã thanh toán nên không thể tự rời phòng. Liên hệ Moxic nếu cần hỗ trợ.",
            "You've already paid, so you can't leave. Contact Moxic if you need help."));
        await RemoveSeatAsync(room, seat, "left");
        return (room, null);
    }

    public async Task<(ShareRoom? Room, string? Error)> KickAsync(string code, string ownerId)
    {
        var room = await LoadAsync(code);
        if (room == null) return (null, NotFound());
        if (room.OwnerUserId != ownerId) return (null, T("Chỉ chủ phòng mới làm được việc này.", "Only the room owner can do this."));
        var partner = Active(room).FirstOrDefault(s => !s.IsOwner);
        if (partner == null || room.Status != "Full") return (null, T("Phòng chưa có người share.", "Nobody has joined yet."));
        if (partner.PaidAmount > 0) return (null, T("Người share đã thanh toán, không thể mời ra.", "Your partner has paid and can't be removed."));
        await RemoveSeatAsync(room, partner, "kicked");
        return (room, null);
    }

    public async Task<(ShareRoom? Room, string? Error)> CancelAsync(string code, string ownerId)
    {
        var room = await LoadAsync(code);
        if (room == null) return (null, NotFound());
        if (room.OwnerUserId != ownerId) return (null, T("Chỉ chủ phòng mới làm được việc này.", "Only the room owner can do this."));
        if (room.Status is not ("Open" or "Full")) return (null, T("Phòng đã chốt hoặc đã đóng.", "This room is settled or closed."));
        if (room.Seats.Any(s => s.PaidAmount > 0)) return (null, T("Đã có người thanh toán nên không thể hủy phòng. Liên hệ Moxic nếu cần hỗ trợ.",
            "Someone has already paid, so the room can't be cancelled. Contact Moxic for help."));
        await CloseAsync(room, "owner");
        return (room, null);
    }

    /// <summary>Closes an Open/Full room: every member leaves ("closed"); paid seats are queued for a manual refund.</summary>
    public async Task CloseAsync(ShareRoom room, string reason)
    {
        var now = DateTime.UtcNow;
        room.Status = "Cancelled";
        room.CancelReason = reason;
        room.ClosedAt = now;
        room.UpdatedAt = now;
        foreach (var s in Active(room))
        {
            s.LeftAt = now;
            s.LeftReason = "closed";
            if (s.PaidAmount > 0 && s.RefundedAt == null) s.NeedsRefund = true;
        }
        System(room, "Phòng đã đóng", "The room was closed");
        await _db.SaveChangesAsync();
        await _events.RoomCancelled(room);
    }

    /// <summary>
    /// Removes a member (left / kicked / timeout). The owner leaving hands the room to the partner (who becomes owner);
    /// an owner alone closes the room. A partner leaving reopens the room for someone new.
    /// </summary>
    public async Task RemoveSeatAsync(ShareRoom room, ShareSeat seat, string reason)
    {
        var now = DateTime.UtcNow;
        seat.LeftAt = now;
        seat.LeftReason = reason;
        room.UpdatedAt = now;
        var other = Active(room).FirstOrDefault(s => s.Id != seat.Id);

        if (other == null)
        {
            room.Status = "Cancelled";
            room.CancelReason = reason;
            room.ClosedAt = now;
            System(room, $"{seat.DisplayName} đã rời phòng · phòng đã đóng", $"{seat.DisplayName} left · the room is closed");
            await _db.SaveChangesAsync();
            await _events.SeatRemoved(room, seat, reason);
            await _events.RoomCancelled(room);
            return;
        }

        if (seat.IsOwner)
        {
            seat.IsOwner = false;
            other.IsOwner = true;
            room.OwnerUserId = other.UserId;
            room.OwnerPercent = other.Percent;
            seat.XboxEmail = null;
            seat.XboxPasswordEncrypted = null;
        }
        room.Status = "Open";
        room.FullAt = null;
        var vi = reason switch
        {
            "kicked" => $"{seat.DisplayName} đã được mời ra khỏi phòng",
            "timeout" => $"{seat.DisplayName} quá 48 giờ chưa thanh toán nên đã rời phòng",
            _ => $"{seat.DisplayName} đã rời phòng",
        };
        var en = reason switch
        {
            "kicked" => $"{seat.DisplayName} was removed from the room",
            "timeout" => $"{seat.DisplayName} didn't pay within 48 hours and left the room",
            _ => $"{seat.DisplayName} left the room",
        };
        System(room, vi + " · đang tìm người share mới", en + " · looking for a new partner");
        if (other.IsOwner && room.AccountType == "Owner" && other.XboxEmail == null)
            System(room, $"{other.DisplayName} giờ là chủ phòng, hãy nhập tài khoản Xbox để cài game", $"{other.DisplayName} is now the owner — please add your Xbox account");
        await _db.SaveChangesAsync();
        await _events.SeatRemoved(room, seat, reason);
    }

    // ───────────────────────── settings before payment ─────────────────────────

    public async Task<(ShareRoom? Room, string? Error)> SetPercentAsync(string code, string ownerId, int percent)
    {
        var room = await LoadAsync(code);
        if (room == null) return (null, NotFound());
        if (room.OwnerUserId != ownerId) return (null, T("Chỉ chủ phòng mới làm được việc này.", "Only the room owner can do this."));
        if (room.Locked || room.Seats.Any(s => s.PaidAmount > 0) || room.Status is not ("Open" or "Full"))
            return (null, T("Đã có người thanh toán nên không đổi được tỷ lệ.", "Someone has paid, so the split is locked."));
        if (!ShareRules.IsValidPercent(percent))
            return (null, T("Tỷ lệ phải từ 10% đến 90%, bước 5%.", "The split must be 10–90% in steps of 5%."));

        var (ownerAmount, partnerAmount) = ShareRules.Split(room.TotalPrice, percent);
        room.OwnerPercent = percent;
        room.UpdatedAt = DateTime.UtcNow;
        foreach (var s in Active(room))
        {
            s.Percent = s.IsOwner ? percent : 100 - percent;
            s.ShareAmount = s.IsOwner ? ownerAmount : partnerAmount;
            await ReapplyCouponAsync(room, s);
        }
        var owner = Active(room).Single(s => s.IsOwner);
        System(room, $"{owner.DisplayName} đổi tỷ lệ thành {percent}/{100 - percent}", $"{owner.DisplayName} changed the split to {percent}/{100 - percent}");
        await _db.SaveChangesAsync();
        return (room, null);
    }

    /// <summary>Re-evaluates a seat's voucher after its share changed; drops it when it no longer applies.</summary>
    private async Task ReapplyCouponAsync(ShareRoom room, ShareSeat seat)
    {
        if (seat.CouponCode != null)
        {
            var (eval, coupon, _) = await _coupons.QuoteAsync(seat.UserId, seat.CouponCode, SeatLines(room, seat));
            if (eval.Ok && coupon != null)
            {
                seat.DiscountAmount = eval.DiscountAmount;
            }
            else
            {
                seat.CouponId = null;
                seat.CouponCode = null;
                seat.DiscountAmount = 0;
            }
        }
        seat.AmountDue = seat.ShareAmount - seat.DiscountAmount;
    }

    private static List<PricedLine> SeatLines(ShareRoom room, ShareSeat seat) =>
        new() { new PricedLine(room.GameId, room.GameName, seat.ShareAmount, room.EditionId) };

    public async Task<(ShareSeat? Seat, string? Error)> ApplyCouponAsync(string code, string userId, string? couponCode)
    {
        var room = await LoadAsync(code);
        var seat = room == null ? null : Active(room).FirstOrDefault(s => s.UserId == userId);
        if (room == null || seat == null) return (null, NotFound());
        if (seat.PaidAmount > 0 || room.Status is not ("Open" or "Full"))
            return (null, T("Bạn đã thanh toán nên không đổi được voucher.", "You've paid, so the voucher can't change."));

        if (string.IsNullOrWhiteSpace(couponCode))
        {
            seat.CouponId = null;
            seat.CouponCode = null;
            seat.DiscountAmount = 0;
        }
        else
        {
            var (eval, coupon, _) = await _coupons.QuoteAsync(userId, couponCode, SeatLines(room, seat));
            if (!eval.Ok || coupon == null) return (null, eval.Error ?? MsgNotFound);
            seat.CouponId = coupon.Id;
            seat.CouponCode = coupon.Code;
            seat.DiscountAmount = eval.DiscountAmount;
        }
        seat.AmountDue = seat.ShareAmount - seat.DiscountAmount;
        await _db.SaveChangesAsync();
        return (seat, null);
    }

    public async Task<(ShareRoom? Room, string? Error)> SetOwnerXboxAsync(string code, string userId, string? email, string? password)
    {
        var room = await LoadAsync(code);
        if (room == null) return (null, NotFound());
        var seat = Active(room).FirstOrDefault(s => s.UserId == userId);
        if (seat == null || !seat.IsOwner) return (null, T("Chỉ chủ phòng mới làm được việc này.", "Only the room owner can do this."));
        if (room.AccountType != "Owner") return (null, T("Phòng này dùng tài khoản Moxic cấp.", "This room uses a Moxic-provided account."));
        if (room.Status is not ("Open" or "Full")) return (null, T("Phòng đã chốt.", "This room is settled."));
        email = email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || email.Length > 200)
            return (null, T("Email Xbox không hợp lệ.", "Invalid Xbox email."));
        if (string.IsNullOrWhiteSpace(password) || password.Length > 200)
            return (null, T("Mật khẩu Xbox không được để trống.", "The Xbox password is required."));
        seat.XboxEmail = email;
        seat.XboxPasswordEncrypted = _protector.Protect(password);
        room.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (room, null);
    }

    /// <summary>Gives the member their transfer code (stable once issued). Only once the room is full.</summary>
    public async Task<(ShareSeat? Seat, string? Error)> StartPaymentAsync(string code, string userId)
    {
        var room = await LoadAsync(code);
        var seat = room == null ? null : Active(room).FirstOrDefault(s => s.UserId == userId);
        if (room == null || seat == null) return (null, NotFound());
        if (seat.PaidAt != null) return (seat, null);
        if (room.Status != "Full") return (null, T("Phòng chưa đủ người, chưa thể thanh toán.", "The room isn't full yet, so payment isn't open."));
        if (room.AccountType == "Owner" && Active(room).Single(s => s.IsOwner).XboxEmail == null)
            return (null, seat.IsOwner
                ? T("Hãy nhập tài khoản Xbox (sẽ cài game vào đó) trước khi thanh toán.", "Add the Xbox account the game goes on before paying.")
                : T("Chủ phòng chưa nhập tài khoản Xbox, hãy chờ chủ phòng nhập trước.", "The owner hasn't added the Xbox account yet."));
        if (seat.PaymentCode == null)
        {
            string pc;
            do pc = ShareRules.NewPaymentCode();
            while (await _db.ShareSeats.AnyAsync(s => s.PaymentCode == pc));
            seat.PaymentCode = pc;
            await _db.SaveChangesAsync();
        }
        return (seat, null);
    }

    // ───────────────────────── discussion ─────────────────────────

    public async Task<(ShareMessage? Message, string? Error)> PostMessageAsync(string code, string userId, string? text)
    {
        var room = await LoadAsync(code);
        var seat = room == null ? null : Active(room).FirstOrDefault(s => s.UserId == userId);
        if (room == null || seat == null) return (null, T("Chỉ thành viên phòng mới nhắn được.", "Only room members can post."));
        text = text?.Trim();
        if (string.IsNullOrEmpty(text)) return (null, T("Tin nhắn trống.", "The message is empty."));
        if (text.Length > 1000) text = text[..1000];
        var since = DateTime.UtcNow.AddMinutes(-1);
        if (await _db.ShareMessages.CountAsync(m => m.RoomId == room.Id && m.UserId == userId && m.CreatedAt > since) >= MaxMessagesPerMinute)
            return (null, T("Bạn nhắn nhanh quá, chờ một chút nhé.", "You're sending too fast, wait a moment."));
        var msg = new ShareMessage { Id = Guid.NewGuid(), RoomId = room.Id, UserId = userId, Text = text, CreatedAt = DateTime.UtcNow };
        _db.ShareMessages.Add(msg);
        await _db.SaveChangesAsync();
        return (msg, null);
    }

    public async Task<string?> ReportMessageAsync(string code, string userId, Guid messageId)
    {
        var room = await LoadAsync(code);
        if (room == null || !Active(room).Any(s => s.UserId == userId)) return NotFound();
        var msg = await _db.ShareMessages.FirstOrDefaultAsync(m => m.Id == messageId && m.RoomId == room.Id && m.UserId != null && m.UserId != userId);
        if (msg == null) return T("Không tìm thấy tin nhắn.", "Message not found.");
        if (!msg.Reported)
        {
            msg.Reported = true;
            await _db.SaveChangesAsync();
            await _events.MessageReported(room, msg);
        }
        return null;
    }

    // ───────────────────────── payments ─────────────────────────

    /// <summary>
    /// Records a transfer whose content carries a seat payment code and settles the seat; when both seats are paid
    /// the order is created. Returns false when this transaction was already processed (duplicate webhook).
    /// </summary>
    /// <param name="skipDuplicateCheck">true when an admin assigns an already stored transaction by hand.</param>
    public async Task<bool> HandleTransferAsync(BankTransaction tx, string paymentCode, bool skipDuplicateCheck = false)
    {
        if (!skipDuplicateCheck && await _db.BankTransactions.AnyAsync(t => t.Provider == tx.Provider && t.ProviderTxnId == tx.ProviderTxnId)) return false;

        var seat = await _db.ShareSeats.FirstOrDefaultAsync(s => s.PaymentCode == paymentCode);
        var room = seat == null ? null : await _db.ShareRooms.Include(r => r.Seats).FirstAsync(r => r.Id == seat.RoomId);
        tx.OrderCode = paymentCode;
        string? problem = null;
        var paidNow = false;

        if (seat == null || room == null)
        {
            tx.Status = "Unmatched";
            problem = $"💸 <b>Tiền về với mã share không tồn tại</b>\n{Vnd(tx.Amount)}\nNội dung: <code>{TelegramBot.Html(tx.Content)}</code>\nGán tay trong admin → Thanh toán → Giao dịch.";
        }
        else if (seat.PaidAt != null)
        {
            seat.PaidAmount += tx.Amount;
            tx.Status = "AlreadyPaid";
            tx.Note = "Phần share đã thanh toán trước đó";
            problem = $"⚠️ Nhận thêm {Vnd(tx.Amount)} cho phần share <code>{paymentCode}</code> (phòng {room.Code}) đã thanh toán — kiểm tra hoàn tiền";
        }
        else if (seat.LeftAt != null || room.Status is not ("Full"))
        {
            seat.PaidAmount += tx.Amount;
            seat.NeedsRefund = true;
            tx.Status = "AlreadyPaid";
            tx.Note = $"Phòng {room.Code} không còn nhận thanh toán ({room.Status})";
            problem = $"⚠️ <b>Cần hoàn tiền</b>: nhận {Vnd(tx.Amount)} cho phần share <code>{paymentCode}</code> nhưng phòng {room.Code} đã {(room.Status == "Cancelled" ? "đóng" : "thay đổi")} hoặc người này đã rời phòng.";
        }
        else
        {
            seat.PaidAmount += tx.Amount;
            if (seat.PaidAmount + 0.5m < seat.AmountDue)
            {
                tx.Status = "Underpaid";
                tx.Note = $"Đã nhận {Vnd(seat.PaidAmount)} / {Vnd(seat.AmountDue)}";
                problem = $"⚠️ Khách chuyển THIẾU cho phần share <code>{paymentCode}</code> (phòng {room.Code}): {tx.Note}";
            }
            else
            {
                tx.Status = "Matched";
                seat.PaidAt = DateTime.UtcNow;
                room.Locked = true;
                room.UpdatedAt = seat.PaidAt.Value;
                paidNow = true;
                System(room, $"{seat.DisplayName} đã thanh toán phần của mình", $"{seat.DisplayName} paid their part");
            }
        }

        if (_db.Entry(tx).State == EntityState.Detached) _db.BankTransactions.Add(tx); // manual assign passes a stored row
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            return false; // concurrent duplicate webhook delivery
        }

        if (problem != null) await _events.TransferProblem(problem);
        if (paidNow)
        {
            _logger.LogInformation("Share seat {Code} paid ({Amount}) in room {Room}", paymentCode, seat!.PaidAmount, room!.Code);
            await _events.SeatPaid(room, seat);
            await TryFundAsync(room.Id);
        }
        return true;
    }

    /// <summary>
    /// When both seats of a Full room are paid, flips it to Funded (conditional update — exactly one caller wins)
    /// and creates the order. Called after every seat payment.
    /// </summary>
    private async Task TryFundAsync(Guid roomId)
    {
        var paidSeats = await _db.ShareSeats.AsNoTracking().CountAsync(s => s.RoomId == roomId && s.LeftAt == null && s.PaidAt != null);
        if (paidSeats < ShareRules.MaxSeats) return;
        var now = DateTime.UtcNow;
        var won = await _db.ShareRooms.Where(r => r.Id == roomId && r.Status == "Full")
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Funded").SetProperty(r => r.FundedAt, now).SetProperty(r => r.UpdatedAt, now));
        if (won != 1) return;

        _db.ChangeTracker.Clear();
        var room = await _db.ShareRooms.Include(r => r.Seats).FirstAsync(r => r.Id == roomId);
        var order = await CreateOrderAsync(room);
        await _events.RoomFunded(room, order);
    }

    private async Task<Order> CreateOrderAsync(ShareRoom room)
    {
        var seats = Active(room).OrderByDescending(s => s.IsOwner).ToList();
        var owner = seats[0];
        var now = DateTime.UtcNow;
        var listPrice = await _db.Games.AsNoTracking().Where(g => g.Id == room.GameId).Select(g => (decimal?)g.OriginalPrice).FirstOrDefaultAsync();
        if (room.EditionId != null)
            listPrice = await _db.GameEditions.AsNoTracking().Where(e => e.Id == room.EditionId).Select(e => (decimal?)e.OriginalPrice).FirstOrDefaultAsync() ?? listPrice;

        var couponSeat = seats.FirstOrDefault(s => s.CouponId != null);
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = $"MOXIC-{now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..5].ToUpper()}",
            Lang = owner.Lang,
            CustomerPhone = string.Empty,
            CustomerXboxEmail = room.AccountType == "Owner" ? owner.XboxEmail ?? string.Empty : string.Empty,
            CustomerXboxPasswordEncrypted = room.AccountType == "Owner" ? owner.XboxPasswordEncrypted ?? string.Empty : string.Empty,
            CustomerId = owner.UserId,
            TotalAmount = seats.Sum(s => s.AmountDue),
            DiscountAmount = seats.Sum(s => s.DiscountAmount),
            CouponId = couponSeat?.CouponId,
            CouponCode = couponSeat?.CouponCode,
            Status = OrderStatus.Verifying,
            PaymentMethod = PaymentMethod.Bank,
            PaidAt = now,
            ShareRoomId = room.Id,
            Notes = $"Phòng share {room.Code} · {(room.AccountType == "Owner" ? "tài khoản chủ phòng" : "tài khoản Moxic cấp")} · " +
                    string.Join(" + ", seats.Select(s => $"{s.DisplayName} {s.Percent}% {Vnd(s.AmountDue)}")),
            CreatedAt = now,
            UpdatedAt = now,
        };
        order.Details.Add(new OrderDetail
        {
            Id = Guid.NewGuid(), OrderId = order.Id, GameId = room.GameId, GameName = room.GameName, Price = room.TotalPrice,
            ListPrice = listPrice, EditionId = room.EditionId,
        });

        await using var tx = await _db.Database.BeginTransactionAsync();
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        // Each member's voucher is redeemed against the order. A voucher that ran out since it was applied is still
        // honoured (the member already paid the discounted amount) — the savepoint undoes that redeem's partial work.
        foreach (var s in seats.Where(s => s.CouponCode != null))
        {
            await tx.CreateSavepointAsync("coupon");
            var (eval, _) = await _coupons.RedeemAsync(s.UserId, s.CouponCode, SeatLines(room, s), order.Id);
            if (eval.Ok) await _db.SaveChangesAsync();
            else
            {
                await tx.RollbackToSavepointAsync("coupon");
                foreach (var e in _db.ChangeTracker.Entries<CouponRedemption>().Where(e => e.State == EntityState.Added).ToList()) e.State = EntityState.Detached;
                _logger.LogWarning("Share room {Room}: voucher {Coupon} of {User} no longer redeemable ({Error}); discount honoured", room.Code, s.CouponCode, s.UserId, eval.Error);
            }
        }

        room.OrderId = order.Id;
        System(room, $"Cả hai đã thanh toán · đã tạo đơn {order.OrderCode}, Moxic sẽ cài game sớm", $"Both paid · order {order.OrderCode} created, Moxic will install the game soon");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        _logger.LogInformation("Share room {Room} funded → order {Order} ({Total})", room.Code, order.OrderCode, order.TotalAmount);
        return order;
    }

    // ───────────────────────── admin ─────────────────────────

    /// <summary>A stored transaction tracked by this service's context (for manual assignment).</summary>
    public Task<BankTransaction?> LoadTransactionAsync(Guid id) => _db.BankTransactions.FirstOrDefaultAsync(t => t.Id == id);

    public async Task<string?> MarkRefundedAsync(Guid seatId)
    {
        var seat = await _db.ShareSeats.FirstOrDefaultAsync(s => s.Id == seatId);
        if (seat == null) return "Không tìm thấy";
        if (!seat.NeedsRefund || seat.RefundedAt != null) return "Phần này không cần hoàn tiền";
        seat.RefundedAt = DateTime.UtcNow;
        seat.NeedsRefund = false;
        await _db.SaveChangesAsync();
        var room = await _db.ShareRooms.Include(r => r.Seats).FirstAsync(r => r.Id == seat.RoomId);
        await _events.Refunded(room, seat);
        return null;
    }

    private static string Cut(string s, int max) => s.Length > max ? s[..max] : s;
}
