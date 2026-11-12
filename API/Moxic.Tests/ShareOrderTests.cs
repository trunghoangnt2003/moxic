using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class ShareOrderTests
{
    /// <summary>A (60%, owner) and B (40%) both paid: returns the created order.</summary>
    private static async Task<Order> FundedOrderAsync(IServiceProvider sp, string accountType = "Owner")
    {
        using var scope = sp.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var svc = scope.ServiceProvider.GetRequiredService<ShareRoomService>();
        var room = await FullRoomAsync(ctx, svc, 60, accountType);
        await TestServices.MakeCustomersAsync(sp);
        foreach (var u in new[] { A.UserId, B.UserId })
        {
            var s = (await svc.StartPaymentAsync(room.Code, u)).Seat!;
            await svc.HandleTransferAsync(Tx(s.AmountDue, s.PaymentCode!), s.PaymentCode!);
        }
        return await ctx.Orders.AsNoTracking().SingleAsync();
    }

    [Fact]
    public async Task Partner_sees_share_order_in_history()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp);
        using var scope = sp.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var svc = scope.ServiceProvider.GetRequiredService<ShareRoomService>();
        Assert.True(await ctx.Orders.AnyAsync(svc.OwnedBy(B.UserId, B.Email)));
        Assert.True(await ctx.Orders.AnyAsync(svc.OwnedBy(A.UserId, A.Email)));
        Assert.False(await ctx.Orders.AnyAsync(svc.OwnedBy(C.UserId, C.Email)));

        var view = await svc.OrderShareViewAsync(order.ShareRoomId!.Value, B.UserId, order.Status);
        Assert.NotNull(view);
        Assert.Equal(360000, view!.YourAmount);
        Assert.Equal(900000, view.TotalAmount);
        Assert.Equal("Minh", view.PartnerName);
        Assert.False(view.IsOwner);
        Assert.Null(view.ProvidedAccount);
    }

    [Fact]
    public async Task Provided_account_visible_to_both_only_after_completion()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp, "Moxic");
        using var scope = sp.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<ShareRoomService>();
        Assert.Null(await svc.SetProvidedAccountAsync(order.Id, "shared@moxic.co", "S3cret!"));

        Assert.Null((await svc.OrderShareViewAsync(order.ShareRoomId!.Value, B.UserId, OrderStatus.Installing))!.ProvidedAccount);
        var done = await svc.OrderShareViewAsync(order.ShareRoomId!.Value, B.UserId, OrderStatus.Completed);
        Assert.Equal("shared@moxic.co", done!.ProvidedAccount!.Email);
        Assert.Equal("S3cret!", done.ProvidedAccount.Password);
        Assert.Null(await svc.OrderShareViewAsync(order.ShareRoomId!.Value, C.UserId, OrderStatus.Completed));
    }

    [Fact]
    public async Task Provided_account_rejected_for_owner_account_rooms()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp, "Owner");
        using var scope = sp.CreateScope();
        Assert.NotNull(await scope.ServiceProvider.GetRequiredService<ShareRoomService>().SetProvidedAccountAsync(order.Id, "x@moxic.co", "pw"));
    }

    [Fact]
    public async Task Status_change_notifies_partner_too()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp);
        using var scope = sp.CreateScope();
        var r = await scope.ServiceProvider.GetRequiredService<OrderStatusService>().ChangeAsync(order.Id, OrderStatus.Installing, null);
        Assert.True(r.Ok, r.Error);
        var ctx = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var users = await ctx.Notifications.Where(n => n.Type == "order").Select(n => n.UserId).ToListAsync();
        Assert.Equal(new[] { A.UserId, B.UserId }.OrderBy(x => x), users.OrderBy(x => x));
    }

    [Fact]
    public async Task Points_split_by_percent_per_member_once()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp);
        using (var scope = sp.CreateScope())
        {
            var statuses = scope.ServiceProvider.GetRequiredService<OrderStatusService>();
            Assert.True((await statuses.ChangeAsync(order.Id, OrderStatus.Installing, null)).Ok);
            var emailsBefore = sp.GetRequiredService<CountingEmailQueue>().Count;
            Assert.True((await statuses.ChangeAsync(order.Id, OrderStatus.Completed, null)).Ok);
            // "game installed" email to both members (the queue also carries web-push jobs, hence >=)
            Assert.True(sp.GetRequiredService<CountingEmailQueue>().Count - emailsBefore >= 2);
        }
        using (var scope = sp.CreateScope())
        {
            var points = scope.ServiceProvider.GetRequiredService<PointsService>();
            Assert.Equal(60, await points.GetBalanceAsync(A.UserId));
            Assert.Equal(40, await points.GetBalanceAsync(B.UserId));
            var ctx = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
            var o = await ctx.Orders.SingleAsync();
            Assert.Equal(0, await points.AwardForCompletedOrderAsync(o)); // idempotent
            Assert.Equal(60, await points.GetBalanceAsync(A.UserId));
        }
    }

    [Fact]
    public async Task Cancelling_a_share_order_queues_both_members_for_refund()
    {
        await using var db = await TestDb.CreateAsync();
        await using var sp = TestServices.Build(db);
        var order = await FundedOrderAsync(sp);
        using var scope = sp.CreateScope();
        var r = await scope.ServiceProvider.GetRequiredService<OrderStatusService>().ChangeAsync(order.Id, OrderStatus.Cancelled, "Hết hàng");
        Assert.True(r.Ok, r.Error);
        var ctx = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var seats = await ctx.ShareSeats.AsNoTracking().Where(s => s.RoomId == order.ShareRoomId).ToListAsync();
        Assert.Equal(2, seats.Count(s => s.NeedsRefund && s.RefundedAt == null));
    }
}
