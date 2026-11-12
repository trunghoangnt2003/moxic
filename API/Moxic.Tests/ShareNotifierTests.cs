using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class CountingEmailQueue : IBackgroundEmailQueue
{
    public int Count;
    public void Enqueue(Func<IServiceScopeFactory, CancellationToken, Task> emailTask) => Interlocked.Increment(ref Count);
    public Task<Func<IServiceScopeFactory, CancellationToken, Task>> DequeueAsync(CancellationToken ct) => new TaskCompletionSource<Func<IServiceScopeFactory, CancellationToken, Task>>().Task;
}

public class ShareNotifierTests
{
    private static (ShareNotifier Notifier, CountingEmailQueue Emails) Notifier(MoxicDbContext ctx)
    {
        var config = new ConfigurationBuilder().Build();
        var emails = new CountingEmailQueue();
        var push = new PushService(config, emails, NullLogger<PushService>.Instance);
        var notifications = new NotificationService(ctx, null!, NullLogger<NotificationService>.Instance, push);
        var scopes = new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
        return (new ShareNotifier(ctx, notifications, emails, scopes, config, NullLogger<ShareNotifier>.Instance), emails);
    }

    [Fact]
    public async Task RoomFull_notifies_both_members()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var room = await FullRoomAsync(ctx, Service(ctx));
        var (n, _) = Notifier(ctx);
        await n.RoomFull(room);
        var users = await ctx.Notifications.Where(x => x.Type == "share").Select(x => x.UserId).ToListAsync();
        Assert.Equal(new[] { A.UserId, B.UserId }.OrderBy(x => x), users.OrderBy(x => x));
    }

    [Fact]
    public async Task SeatPaid_notifies_only_the_other_member()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var room = await FullRoomAsync(ctx, Service(ctx));
        var (n, _) = Notifier(ctx);
        var payer = room.Seats.Single(s => s.UserId == A.UserId);
        await n.SeatPaid(room, payer);
        var users = await ctx.Notifications.Where(x => x.Type == "share").Select(x => x.UserId).ToListAsync();
        Assert.Equal(new[] { B.UserId }, users);
    }
}
