using Microsoft.EntityFrameworkCore;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class ShareMaintenanceTests
{
    [Fact]
    public async Task Unpaid_partner_after_48h_removed_room_reopens()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        var a = (await svc.StartPaymentAsync(room.Code, A.UserId)).Seat!;
        await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!);

        Assert.Equal(0, await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(47)));
        Assert.Equal(1, await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(49)));

        await using var check = db.NewContext();
        var r = await check.ShareRooms.Include(x => x.Seats).SingleAsync();
        Assert.Equal("Open", r.Status);
        Assert.Null(r.FullAt);
        var b = r.Seats.Single(s => s.UserId == B.UserId);
        Assert.Equal("timeout", b.LeftReason);
        Assert.NotNull(r.Seats.Single(s => s.UserId == A.UserId).PaidAt);
        Assert.Contains($"removed:{B.UserId}:timeout", events.Events);
    }

    [Fact]
    public async Task Unpaid_owner_after_48h_removed_paid_partner_becomes_owner()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var room = await FullRoomAsync(ctx, svc, 60);
        var b = (await svc.StartPaymentAsync(room.Code, B.UserId)).Seat!;
        await svc.HandleTransferAsync(Tx(b.AmountDue, b.PaymentCode!), b.PaymentCode!);

        Assert.Equal(1, await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(49)));

        await using var check = db.NewContext();
        var r = await check.ShareRooms.Include(x => x.Seats).SingleAsync();
        Assert.Equal(B.UserId, r.OwnerUserId);
        Assert.Equal(40, r.OwnerPercent);
        Assert.True(r.Locked);
        Assert.Equal("Open", r.Status);
        var oldOwner = r.Seats.Single(s => s.UserId == A.UserId);
        Assert.Null(oldOwner.XboxEmail);
        Assert.False(oldOwner.IsOwner);
        Assert.True(r.Seats.Single(s => s.UserId == B.UserId).IsOwner);

        // A newcomer pays the rest: 900.000 - 360.000.
        await using var ctx2 = db.NewContext();
        var (joined, err) = await Service(ctx2).JoinAsync(room.Code, C);
        Assert.Null(err);
        Assert.Equal(540000, joined!.Seats.Single(s => s.UserId == C.UserId && s.LeftAt == null).AmountDue);
    }

    [Fact]
    public async Task Both_unpaid_after_48h_partner_removed_only()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        await FullRoomAsync(ctx, svc);
        Assert.Equal(1, await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(49)));
        await using var check = db.NewContext();
        var r = await check.ShareRooms.Include(x => x.Seats).SingleAsync();
        Assert.Equal("Open", r.Status);
        Assert.Equal(A.UserId, r.OwnerUserId);
        Assert.Single(r.Seats, s => s.LeftAt == null);
    }

    [Fact]
    public async Task Reminder_sent_once_at_36h()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        await FullRoomAsync(ctx, svc);
        await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(30));
        Assert.DoesNotContain(events.Events, e => e.StartsWith("remind:"));
        await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(37));
        await svc.RunMaintenanceAsync(DateTime.UtcNow.AddHours(38));
        Assert.Equal(2, events.Events.Count(e => e.StartsWith("remind:"))); // once for each unpaid member
        Assert.Contains($"remind:{A.UserId}", events.Events);
        Assert.Contains($"remind:{B.UserId}", events.Events);
    }

    [Fact]
    public async Task Room_older_than_7_days_not_funded_cancelled_paid_seats_NeedsRefund()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var events = new RecordingShareEvents();
        var svc = Service(ctx, events);
        var room = await FullRoomAsync(ctx, svc);
        var a = (await svc.StartPaymentAsync(room.Code, A.UserId)).Seat!;
        await svc.HandleTransferAsync(Tx(a.AmountDue, a.PaymentCode!), a.PaymentCode!);

        await svc.RunMaintenanceAsync(DateTime.UtcNow.AddDays(7).AddMinutes(1));

        await using var check = db.NewContext();
        var r = await check.ShareRooms.Include(x => x.Seats).SingleAsync();
        Assert.Equal("Cancelled", r.Status);
        Assert.Equal("expired", r.CancelReason);
        var seatA = r.Seats.Single(s => s.UserId == A.UserId);
        Assert.True(seatA.NeedsRefund);
        Assert.Equal("closed", seatA.LeftReason);
        Assert.Contains("cancelled", events.Events);

        Assert.Null(await svc.MarkRefundedAsync(seatA.Id));
        Assert.Contains($"refunded:{A.UserId}", events.Events);
    }

    [Fact]
    public async Task Funded_room_untouched_by_maintenance()
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
        Assert.Equal(0, await svc.RunMaintenanceAsync(DateTime.UtcNow.AddDays(30)));
        await using var check = db.NewContext();
        Assert.Equal("Funded", (await check.ShareRooms.SingleAsync()).Status);
    }
}
