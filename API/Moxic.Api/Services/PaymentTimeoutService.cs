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
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var expired = await db.Orders
            .Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < cutoff)
            .ToListAsync(ct);
        if (expired.Count == 0) return;
        foreach (var order in expired)
        {
            order.Status = OrderStatus.Cancelled;
            order.CancellationReason = "Het han thanh toan sau 24 gio";
            order.UpdatedAt = DateTime.UtcNow;
            try { await email.SendOrderCancelledAsync(order.CustomerXboxEmail, order.OrderCode, order.CancellationReason); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to send cancellation email for order {code}", order.OrderCode); }
        }
        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Auto-cancelled {count} expired orders", expired.Count);
    }
}
