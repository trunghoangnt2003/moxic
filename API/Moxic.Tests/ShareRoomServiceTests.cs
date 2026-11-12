using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Shared.Enums;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class ShareRoomServiceTests
{
    [Fact]
    public async Task Create_rejects_game_without_AllowShare()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var g = await SeedGameAsync(ctx, allowShare: false);
        var (room, err) = await Service(ctx).CreateAsync(A, Req(g));
        Assert.Null(room);
        Assert.NotNull(err);
    }

    [Fact]
    public async Task Create_rejects_bad_percent()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var g = await SeedGameAsync(ctx);
        Assert.NotNull((await Service(ctx).CreateAsync(A, Req(g, 52))).Error);
        Assert.Null((await Service(ctx).CreateAsync(A, Req(g, 55))).Error);
        Assert.NotNull((await Service(ctx).CreateAsync(A, Req(g, accountType: "Other"))).Error);
    }

    [Fact]
    public async Task Create_snapshots_price_and_creates_owner_seat()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var g = await SeedGameAsync(ctx, 900000);
        var (room, err) = await Service(ctx).CreateAsync(A, Req(g, 60));
        Assert.Null(err);
        Assert.Equal(6, room!.Code.Length);
        Assert.Equal(900000, room.TotalPrice);
        Assert.Equal("Open", room.Status);
        var seat = Assert.Single(room.Seats);
        Assert.True(seat.IsOwner);
        Assert.Equal(60, seat.Percent);
        Assert.Equal(540000, seat.ShareAmount);
        Assert.Equal(540000, seat.AmountDue);
        Assert.Equal("Minh", seat.DisplayName);
    }

    [Fact]
    public async Task Create_and_join_respect_max_three_open_rooms()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var g = await SeedGameAsync(ctx);
        var svc = Service(ctx);
        for (var i = 0; i < 3; i++) Assert.Null((await svc.CreateAsync(A, Req(g))).Error);
        Assert.NotNull((await svc.CreateAsync(A, Req(g))).Error);

        var (other, _) = await svc.CreateAsync(B, Req(g));
        Assert.NotNull((await svc.JoinAsync(other!.Code, A)).Error); // A already has 3 open rooms

        // Cancelled rooms don't count.
        var mine = await ctx.ShareRooms.Where(r => r.OwnerUserId == A.UserId).Select(r => r.Code).FirstAsync();
        Assert.Null((await svc.CancelAsync(mine, A.UserId)).Error);
        Assert.Null((await svc.JoinAsync(other.Code, A)).Error);
    }

    [Fact]
    public async Task Join_fills_room_sets_Full_and_FullAt()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        Assert.Equal("Full", room.Status);
        Assert.NotNull(room.FullAt);
        var partner = await SeatAsync(ctx, room.Code, B.UserId);
        Assert.Equal(40, partner.Percent);
        Assert.Equal(360000, partner.ShareAmount);
        Assert.Contains($"joined:{B.UserId}", events.Events);
        Assert.Contains("full", events.Events);
    }

    [Fact]
    public async Task Join_own_room_rejected_and_full_room_rejected()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var g = await SeedGameAsync(ctx);
        var (room, _) = await svc.CreateAsync(A, Req(g));
        Assert.NotNull((await svc.JoinAsync(room!.Code, A)).Error);
        Assert.Null((await svc.JoinAsync(room.Code, B)).Error);
        Assert.NotNull((await svc.JoinAsync(room.Code, C)).Error);
        Assert.NotNull((await svc.JoinAsync("ZZZZZZ", C)).Error);
    }

    [Fact]
    public async Task Join_concurrent_only_one_wins()
    {
        await using var db = await TestDb.CreateAsync();
        string code;
        await using (var ctx = db.NewContext())
        {
            var g = await SeedGameAsync(ctx);
            code = (await Service(ctx).CreateAsync(A, Req(g))).Room!.Code;
        }
        await using var c1 = db.NewContext();
        await using var c2 = db.NewContext();
        var results = await Task.WhenAll(Service(c1).JoinAsync(code, B), Service(c2).JoinAsync(code, C));
        Assert.Equal(1, results.Count(r => r.Error == null));
        await using var check = db.NewContext();
        Assert.Equal(2, await check.ShareSeats.CountAsync(s => s.Room!.Code == code && s.LeftAt == null));
    }

    [Fact]
    public async Task SetPercent_recomputes_both_seats_and_posts_system_message()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, 60);
        Assert.Null((await svc.SetPercentAsync(room.Code, A.UserId, 70)).Error);
        ctx.ChangeTracker.Clear();
        Assert.Equal(630000, (await SeatAsync(ctx, room.Code, A.UserId)).AmountDue);
        Assert.Equal(270000, (await SeatAsync(ctx, room.Code, B.UserId)).AmountDue);
        Assert.True(await ctx.ShareMessages.AnyAsync(m => m.RoomId == room.Id && m.UserId == null && m.Text.Contains("70/30")));
        Assert.NotNull((await svc.SetPercentAsync(room.Code, B.UserId, 50)).Error); // only the owner
    }

    [Fact]
    public async Task SetPercent_after_payment_rejected()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var seat = (await svc.StartPaymentAsync(room.Code, A.UserId)).Seat!;
        Assert.True(await svc.HandleTransferAsync(Tx(seat.AmountDue, seat.PaymentCode!), seat.PaymentCode!));
        Assert.NotNull((await svc.SetPercentAsync(room.Code, A.UserId, 50)).Error);
    }

    [Fact]
    public async Task Leave_and_kick_rules()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);

        // Unpaid partner leaves → room reopens.
        Assert.Null((await svc.LeaveAsync(room.Code, B.UserId)).Error);
        ctx.ChangeTracker.Clear();
        var r = await ctx.ShareRooms.SingleAsync(x => x.Id == room.Id);
        Assert.Equal("Open", r.Status);
        Assert.Null(r.FullAt);

        // C joins, pays; C can't leave and can't be kicked.
        Assert.Null((await svc.JoinAsync(room.Code, C)).Error);
        var seat = (await svc.StartPaymentAsync(room.Code, C.UserId)).Seat!;
        Assert.True(await svc.HandleTransferAsync(Tx(seat.AmountDue, seat.PaymentCode!), seat.PaymentCode!));
        Assert.NotNull((await svc.LeaveAsync(room.Code, C.UserId)).Error);
        Assert.NotNull((await svc.KickAsync(room.Code, A.UserId)).Error);
        Assert.NotNull((await svc.CancelAsync(room.Code, A.UserId)).Error); // someone paid
    }

    [Fact]
    public async Task Kick_unpaid_partner_and_owner_cancel()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        Assert.NotNull((await svc.KickAsync(room.Code, B.UserId)).Error); // only the owner kicks
        Assert.Null((await svc.KickAsync(room.Code, A.UserId)).Error);
        Assert.Contains($"removed:{B.UserId}:kicked", events.Events);
        Assert.Null((await svc.CancelAsync(room.Code, A.UserId)).Error);
        ctx.ChangeTracker.Clear();
        Assert.Equal("Cancelled", (await ctx.ShareRooms.SingleAsync(x => x.Id == room.Id)).Status);
    }

    [Fact]
    public async Task ApplyCoupon_discount_evaluated_on_seat_share()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, 60);
        var now = DateTime.UtcNow;
        ctx.Coupons.Add(new Coupon { Id = Guid.NewGuid(), Code = "MOXIC10", Name = "10%", DiscountType = CouponDiscountType.Percent, Value = 10, MaxUsesPerCustomer = 1, CreatedAt = now, UpdatedAt = now });
        await ctx.SaveChangesAsync();

        var (seat, err) = await svc.ApplyCouponAsync(room.Code, B.UserId, "moxic10");
        Assert.Null(err);
        Assert.Equal(36000, seat!.DiscountAmount);
        Assert.Equal(324000, seat.AmountDue);
        Assert.Equal("MOXIC10", seat.CouponCode);
        Assert.Equal(540000, (await SeatAsync(ctx, room.Code, A.UserId)).AmountDue);

        Assert.NotNull((await svc.ApplyCouponAsync(room.Code, B.UserId, "NOPE99")).Error);
        var (cleared, _) = await svc.ApplyCouponAsync(room.Code, B.UserId, null);
        Assert.Equal(360000, cleared!.AmountDue);
    }

    [Fact]
    public async Task ApplyCoupon_after_paid_rejected()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var seat = (await svc.StartPaymentAsync(room.Code, B.UserId)).Seat!;
        Assert.True(await svc.HandleTransferAsync(Tx(seat.AmountDue, seat.PaymentCode!), seat.PaymentCode!));
        Assert.NotNull((await svc.ApplyCouponAsync(room.Code, B.UserId, null)).Error);
    }

    [Fact]
    public async Task StartPayment_requires_Full_room_and_owner_xbox()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var g = await SeedGameAsync(ctx);
        var (room, _) = await svc.CreateAsync(A, Req(g));
        Assert.NotNull((await svc.StartPaymentAsync(room!.Code, A.UserId)).Error); // not full
        await svc.JoinAsync(room.Code, B);
        Assert.NotNull((await svc.StartPaymentAsync(room.Code, B.UserId)).Error); // owner Xbox missing
        Assert.Null((await svc.SetOwnerXboxAsync(room.Code, A.UserId, "x@a.vn", "pw")).Error);
        var (seat, err) = await svc.StartPaymentAsync(room.Code, B.UserId);
        Assert.Null(err);
        Assert.StartsWith("MXR", seat!.PaymentCode);
        Assert.Equal(11, seat.PaymentCode!.Length);
        Assert.Equal(seat.PaymentCode, (await svc.StartPaymentAsync(room.Code, B.UserId)).Seat!.PaymentCode); // stable
        Assert.NotNull((await svc.SetOwnerXboxAsync(room.Code, B.UserId, "x@b.vn", "pw")).Error); // only the owner

        var stored = await SeatAsync(ctx, room.Code, A.UserId);
        Assert.NotEqual("pw", stored.XboxPasswordEncrypted);
    }

    [Fact]
    public async Task Moxic_account_room_needs_no_xbox()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, accountType: "Moxic");
        Assert.Null((await svc.StartPaymentAsync(room.Code, A.UserId)).Error);
    }

    [Fact]
    public async Task Message_only_by_current_members()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        Assert.Null((await svc.PostMessageAsync(room.Code, B.UserId, "Chào bạn")).Error);
        Assert.NotNull((await svc.PostMessageAsync(room.Code, C.UserId, "Spam")).Error);
        Assert.NotNull((await svc.PostMessageAsync(room.Code, B.UserId, "   ")).Error);
        await svc.LeaveAsync(room.Code, B.UserId);
        Assert.NotNull((await svc.PostMessageAsync(room.Code, B.UserId, "Còn đây")).Error);
    }
}

public class ShareRoomViewTests
{
    [Fact]
    public async Task Get_room_as_stranger_hides_seat_private_fields()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc);
        var loaded = await svc.LoadAsync(room.Code);

        var stranger = await svc.ViewAsync(loaded!, C.UserId);
        Assert.False(stranger.IsMember);
        Assert.Null(stranger.MyXboxEmail);
        Assert.Null(stranger.OrderCode);
        Assert.Equal(2, stranger.Seats.Count);
        Assert.All(stranger.Seats, s => { Assert.False(s.IsMe); Assert.Null(s.CouponCode); });
        Assert.Equal("paying", stranger.DisplayStatus);

        var partner = await svc.ViewAsync(loaded!, B.UserId);
        Assert.True(partner.IsMember);
        Assert.Null(partner.MyXboxEmail); // the owner's Xbox stays with the owner
        Assert.True(partner.OwnerXboxSet);
        Assert.NotNull(partner.Seats.Single(s => s.IsMe).PayDeadline);

        var owner = await svc.ViewAsync(loaded!, A.UserId);
        Assert.Equal("xbox@a.vn", owner.MyXboxEmail);

        Assert.Null(await svc.MessagesAsync(room.Code, C.UserId, null, false));
        var msgs = await svc.MessagesAsync(room.Code, B.UserId, null, true);
        Assert.Contains(msgs!, m => m.System && m.Text.Contains("joined"));
    }
}
