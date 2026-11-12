using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Shared.Enums;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class ShareTransferTests
{
    private static async Task<(ShareSeat A, ShareSeat B)> PayCodesAsync(ShareRoomService svc, ShareRoom room) =>
        ((await svc.StartPaymentAsync(room.Code, A.UserId)).Seat!, (await svc.StartPaymentAsync(room.Code, B.UserId)).Seat!);

    [Fact]
    public async Task Transfer_full_amount_marks_seat_paid_and_locks_room()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        var (a, _) = await PayCodesAsync(svc, room);
        Assert.True(await svc.HandleTransferAsync(Tx(a.AmountDue, $"CK {a.PaymentCode} thanh toan"), a.PaymentCode!));
        await using var check = db.NewContext();
        var seat = await SeatAsync(check, room.Code, A.UserId);
        Assert.NotNull(seat.PaidAt);
        var r = await check.ShareRooms.SingleAsync(x => x.Id == room.Id);
        Assert.True(r.Locked);
        Assert.Equal("Full", r.Status);
        Assert.Equal("Matched", (await check.BankTransactions.SingleAsync()).Status);
        Assert.Contains($"paid:{A.UserId}", events.Events);
    }

    [Fact]
    public async Task Transfer_underpaid_then_topup_pays_seat()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var (_, b) = await PayCodesAsync(svc, room);
        Assert.True(await svc.HandleTransferAsync(Tx(200000, b.PaymentCode!), b.PaymentCode!));
        ctx.ChangeTracker.Clear();
        Assert.Null((await SeatAsync(ctx, room.Code, B.UserId)).PaidAt);
        Assert.True(await svc.HandleTransferAsync(Tx(160000, b.PaymentCode!), b.PaymentCode!));
        ctx.ChangeTracker.Clear();
        var seat = await SeatAsync(ctx, room.Code, B.UserId);
        Assert.NotNull(seat.PaidAt);
        Assert.Equal(360000, seat.PaidAmount);
        Assert.Equal(new[] { "Matched", "Underpaid" }, await ctx.BankTransactions.Select(t => t.Status).OrderBy(s => s).ToArrayAsync());
    }

    [Fact]
    public async Task Duplicate_txn_id_ignored()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var (a, _) = await PayCodesAsync(svc, room);
        Assert.True(await svc.HandleTransferAsync(Tx(100000, a.PaymentCode!, "txn-1"), a.PaymentCode!));
        Assert.False(await svc.HandleTransferAsync(Tx(100000, a.PaymentCode!, "txn-1"), a.PaymentCode!));
        ctx.ChangeTracker.Clear();
        Assert.Equal(100000, (await SeatAsync(ctx, room.Code, A.UserId)).PaidAmount);
    }

    [Fact]
    public async Task Second_seat_paid_creates_single_order()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc, 60);
        var (a, b) = await PayCodesAsync(svc, room);
        Assert.True(await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!));
        Assert.Equal(0, await ctx.Orders.CountAsync());
        Assert.True(await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!));
        Assert.True(await svc.HandleTransferAsync(Tx(1000, b.PaymentCode!), b.PaymentCode!)); // extra money: no second order

        await using var check = db.NewContext();
        var order = await check.Orders.Include(o => o.Details).SingleAsync();
        Assert.Equal(room.Id, order.ShareRoomId);
        Assert.Equal(A.UserId, order.CustomerId);
        Assert.Equal(900000, order.TotalAmount);
        Assert.Equal(0, order.DiscountAmount);
        Assert.Equal(OrderStatus.Verifying, order.Status);
        Assert.Equal("xbox@a.vn", order.CustomerXboxEmail);
        Assert.False(string.IsNullOrEmpty(order.CustomerXboxPasswordEncrypted));
        var line = Assert.Single(order.Details);
        Assert.Equal(900000, line.Price);
        var r = await check.ShareRooms.SingleAsync(x => x.Id == room.Id);
        Assert.Equal("Funded", r.Status);
        Assert.Equal(order.Id, r.OrderId);
        Assert.Single(events.Events, e => e.StartsWith("funded:"));
        Assert.Contains("problem", events.Events); // the extra 1.000đ is flagged
    }

    [Fact]
    public async Task Moxic_room_order_has_no_customer_xbox()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, accountType: "Moxic");
        var (a, b) = await PayCodesAsync(svc, room);
        await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!);
        await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!);
        await using var check = db.NewContext();
        Assert.Equal("", (await check.Orders.SingleAsync()).CustomerXboxEmail);
    }

    private static async Task<Coupon> CouponAsync(Moxic.Infrastructure.Data.MoxicDbContext ctx, string code, int? maxTotal = null)
    {
        var now = DateTime.UtcNow;
        var c = new Coupon { Id = Guid.NewGuid(), Code = code, Name = code, DiscountType = CouponDiscountType.Fixed, Value = 50000, MaxTotalUses = maxTotal, MaxUsesPerCustomer = 1, CreatedAt = now, UpdatedAt = now };
        ctx.Coupons.Add(c);
        await ctx.SaveChangesAsync();
        return c;
    }

    [Fact]
    public async Task Coupons_redeemed_against_order_for_each_member()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, 60);
        await CouponAsync(ctx, "GIAM50A");
        await CouponAsync(ctx, "GIAM50B");
        Assert.Null((await svc.ApplyCouponAsync(room.Code, A.UserId, "GIAM50A")).Error);
        Assert.Null((await svc.ApplyCouponAsync(room.Code, B.UserId, "GIAM50B")).Error);
        var (a, b) = await PayCodesAsync(svc, room);
        Assert.Equal(490000, a.AmountDue);
        Assert.Equal(310000, b.AmountDue);
        await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!);
        await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!);

        await using var check = db.NewContext();
        var order = await check.Orders.SingleAsync();
        Assert.Equal(800000, order.TotalAmount);
        Assert.Equal(100000, order.DiscountAmount);
        var reds = await check.CouponRedemptions.Where(r => r.OrderId == order.Id).ToListAsync();
        Assert.Equal(2, reds.Count);
        Assert.Equal(new[] { A.UserId, B.UserId }.OrderBy(x => x), reds.Select(r => r.UserId).OrderBy(x => x));

        // Cancelling the order gives both members their voucher back.
        var coupons = new CouponService(check, Microsoft.Extensions.Logging.Abstractions.NullLogger<CouponService>.Instance);
        Assert.True(await coupons.ReleaseForOrderAsync(order.Id));
        Assert.Equal(2, await check.CouponRedemptions.CountAsync(r => r.OrderId == order.Id && r.ReleasedAt != null));
        Assert.All(await check.Coupons.ToListAsync(), c => Assert.Equal(0, c.UsedCount));
    }

    [Fact]
    public async Task Coupon_exhausted_at_order_time_still_honours_seat_discount()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, 60);
        var coupon = await CouponAsync(ctx, "LAST1", maxTotal: 1);
        Assert.Null((await svc.ApplyCouponAsync(room.Code, B.UserId, "LAST1")).Error);
        var (a, b) = await PayCodesAsync(svc, room);
        await ctx.Coupons.Where(c => c.Id == coupon.Id).ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, 1)); // someone else used it
        await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!);
        await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!);

        await using var check = db.NewContext();
        var order = await check.Orders.SingleAsync();
        Assert.Equal(850000, order.TotalAmount);
        Assert.Equal(50000, order.DiscountAmount);
        Assert.Equal(0, await check.CouponRedemptions.CountAsync());
        Assert.Equal(1, (await check.Coupons.SingleAsync()).UsedCount); // the failed redeem left no extra use
    }

    [Fact]
    public async Task Transfer_to_left_seat_or_cancelled_room_marks_AlreadyPaid_and_NeedsRefund()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        var (_, b) = await PayCodesAsync(svc, room);
        Assert.Null((await svc.LeaveAsync(room.Code, B.UserId)).Error);
        Assert.True(await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!));

        await using var check = db.NewContext();
        var seat = await check.ShareSeats.SingleAsync(s => s.PaymentCode == b.PaymentCode);
        Assert.True(seat.NeedsRefund);
        Assert.Null(seat.PaidAt);
        Assert.Equal("AlreadyPaid", (await check.BankTransactions.SingleAsync()).Status);
        Assert.Equal("Open", (await check.ShareRooms.SingleAsync()).Status);
        Assert.Contains("problem", events.Events);
    }

    [Fact]
    public async Task Transfer_unknown_code_Unmatched()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        Assert.True(await Service(ctx, events).HandleTransferAsync(Tx(100000, "MXRAAAAAAAA"), "MXRAAAAAAAA"));
        Assert.Equal("Unmatched", (await ctx.BankTransactions.SingleAsync()).Status);
        Assert.Contains("problem", events.Events);
    }

    [Fact]
    public async Task Concurrent_last_payments_create_exactly_one_order()
    {
        await using var db = await TestDb.CreateAsync();
        ShareSeat a, b;
        string code;
        await using (var ctx = db.NewContext())
        {
            var svc = Service(ctx);
            var room = await FullRoomAsync(ctx, svc);
            code = room.Code;
            (a, b) = await PayCodesAsync(svc, room);
        }
        await using var c1 = db.NewContext();
        await using var c2 = db.NewContext();
        await Task.WhenAll(
            Service(c1).HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!),
            Service(c2).HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!));
        await using var check = db.NewContext();
        Assert.Equal(1, await check.Orders.CountAsync());
    }

    [Fact]
    public async Task Manual_assign_of_stored_transfer_pays_seat_without_duplicating_it()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var (a, _) = await PayCodesAsync(svc, room);
        var stray = Tx(a.AmountDue, "chuyen tien share");
        stray.Status = "Unmatched";
        ctx.BankTransactions.Add(stray);
        await ctx.SaveChangesAsync();
        ctx.ChangeTracker.Clear();

        var stored = await svc.LoadTransactionAsync(stray.Id);
        Assert.True(await svc.HandleTransferAsync(stored!, a.PaymentCode!, skipDuplicateCheck: true));
        await using var check = db.NewContext();
        Assert.Equal("Matched", (await check.BankTransactions.SingleAsync()).Status);
        Assert.NotNull((await SeatAsync(check, room.Code, A.UserId)).PaidAt);
    }
}

public class ShareXboxFormatTests
{
    [Fact]
    public async Task Owner_xbox_password_uses_the_order_format_admin_and_telegram_decrypt()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        foreach (var u in new[] { A.UserId, B.UserId })
        {
            var s = (await svc.StartPaymentAsync(room.Code, u)).Seat!;
            await svc.HandleTransferAsync(Tx(s.AmountDue, s.PaymentCode!), s.PaymentCode!);
        }
        var order = await ctx.Orders.AsNoTracking().SingleAsync();
        // Same decoding as AdminOrdersController / TelegramOrderNotifier.
        var protector = Protection.CreateProtector("XboxPassword");
        var plain = System.Text.Encoding.UTF8.GetString(protector.Unprotect(Convert.FromBase64String(order.CustomerXboxPasswordEncrypted)));
        Assert.Equal("secret", plain);
    }
}

public class ShareOptionalPasswordTests
{
    [Fact]
    public async Task Owner_can_save_xbox_email_without_password_and_order_has_empty_password()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var g = await SeedGameAsync(ctx);
        var room = (await svc.CreateAsync(A, Req(g))).Room!;
        Assert.Null((await svc.SetOwnerXboxAsync(room.Code, A.UserId, "xbox@a.vn", "")).Error);
        await svc.JoinAsync(room.Code, B);
        foreach (var u in new[] { A.UserId, B.UserId })
        {
            var s = (await svc.StartPaymentAsync(room.Code, u)).Seat!;
            await svc.HandleTransferAsync(Tx(s.AmountDue, s.PaymentCode!), s.PaymentCode!);
        }
        var order = await ctx.Orders.AsNoTracking().SingleAsync();
        Assert.Equal("xbox@a.vn", order.CustomerXboxEmail);
        Assert.Equal("", order.CustomerXboxPasswordEncrypted);
    }
}
