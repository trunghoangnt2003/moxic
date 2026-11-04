using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Infrastructure.Services;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public class PaymentTimeoutService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PaymentTimeoutService> _logger;
    private readonly TimeSpan _checkInterval;

    public PaymentTimeoutService(IServiceScopeFactory scopeFactory, ILogger<PaymentTimeoutService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _checkInterval = TimeSpan.FromMinutes(15);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PaymentTimeoutService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
                await CheckExpiredOrdersAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "PaymentTimeoutService error"); }
        }
    }

    private async Task CheckExpiredOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var coupons = scope.ServiceProvider.GetRequiredService<CouponService>();
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var candidates = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < cutoff)
            .Select(o => new { o.Id, o.OrderCode, o.CustomerXboxEmail })
            .ToListAsync(ct);
        if (candidates.Count == 0) return;

        const string reason = "Het han thanh toan sau 24 gio";
        var cancelled = 0;
        foreach (var order in candidates)
        {
            // Per-order transaction: conditional Pending -> Cancelled (loses cleanly to a concurrent
            // admin status change), then the coupon release commits together with the cancel.
            await using (var tx = await db.Database.BeginTransactionAsync(ct))
            {
                var now = DateTime.UtcNow;
                var affected = await db.Orders
                    .Where(o => o.Id == order.Id && o.Status == OrderStatus.Pending)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(o => o.Status, OrderStatus.Cancelled)
                        .SetProperty(o => o.CancellationReason, reason)
                        .SetProperty(o => o.UpdatedAt, now), ct);
                if (affected == 0)
                {
                    await tx.RollbackAsync(ct);
                    continue;
                }
                await coupons.ReleaseForOrderAsync(order.Id, ct);
                await tx.CommitAsync(ct);
            }
            cancelled++;
            TelegramOrderNotifier.RefreshInBackground(_scopeFactory, order.Id, _logger);

            try { await email.SendOrderCancelledAsync(order.CustomerXboxEmail, order.OrderCode, reason); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to send cancellation email for order {code}", order.OrderCode); }
        }
        _logger.LogInformation("Auto-cancelled {count} expired orders", cancelled);
    }
}
