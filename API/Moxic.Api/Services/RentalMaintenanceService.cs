using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Every 5 minutes: cancels unpaid rentals past the payment hold (frees the slot), emails a
/// reminder ~24h before a rental ends, and marks ended rentals Expired (slot stays held until the
/// admin reclaims the account).
/// </summary>
public class RentalMaintenanceService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RentalMaintenanceService> _logger;

    public RentalMaintenanceService(IServiceScopeFactory scopeFactory, ILogger<RentalMaintenanceService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RentalMaintenanceService started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "RentalMaintenanceService error"); }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var notify = scope.ServiceProvider.GetRequiredService<NotificationService>();
        var now = DateTime.UtcNow;

        // 1) Unpaid past the hold → cancelled.
        var holdCutoff = now - RentalService.PaymentHold;
        await db.RentalOrders
            .Where(r => r.Status == RentalStatus.PendingPayment && r.CreatedAt < holdCutoff)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, RentalStatus.Cancelled)
                .SetProperty(r => r.CancelReason, "Quá hạn thanh toán")
                .SetProperty(r => r.UpdatedAt, now), ct);

        // 2) Reminder before the end.
        var remindCutoff = now + RentalService.ReminderBefore;
        var toRemind = await db.RentalOrders
            .Where(r => r.Kind == "Rental" && r.Status == RentalStatus.Active && r.ReminderSentAt == null && r.EndsAt != null && r.EndsAt <= remindCutoff && r.EndsAt > now)
            .ToListAsync(ct);
        foreach (var r in toRemind)
        {
            // Claim first so a crash can't double-send.
            var claimed = await db.RentalOrders.Where(x => x.Id == r.Id && x.ReminderSentAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReminderSentAt, now), ct);
            if (claimed == 0) continue;
            await notify.AddAsync(r.CustomerId, "rental", $"⏰ {r.GameName} sắp hết hạn thuê", $"Hết hạn lúc {r.EndsAt!.Value.AddHours(7):HH:mm dd/MM}. Gia hạn ngay để không bị gián đoạn.", $"/account/rentals/{r.Code}");
            await SafeSend(email, r.CustomerEmail, "Sắp hết hạn thuê game — Moxic GameStore", "SẮP HẾT HẠN THUÊ",
                $"Game {r.GameName} (đơn {r.Code}) sẽ hết hạn lúc {r.EndsAt!.Value.AddHours(7):HH:mm dd/MM/yyyy}.",
                "Bạn có thể gia hạn ngay trong mục \"Game đang thuê\" trên moxic.co để không bị gián đoạn.");
        }

        // 3) Ended → Expired.
        var expired = await db.RentalOrders
            .Where(r => r.Kind == "Rental" && r.Status == RentalStatus.Active && r.EndsAt != null && r.EndsAt <= now)
            .ToListAsync(ct);
        foreach (var r in expired)
        {
            var done = await db.RentalOrders.Where(x => x.Id == r.Id && x.Status == RentalStatus.Active)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, RentalStatus.Expired).SetProperty(x => x.UpdatedAt, now), ct);
            if (done == 0) continue;
            await notify.AddAsync(r.CustomerId, "rental", $"{r.GameName} đã hết hạn thuê", "Gia hạn trước khi tài khoản được thu hồi.", $"/account/rentals/{r.Code}");
            await SafeSend(email, r.CustomerEmail, "Đã hết hạn thuê game — Moxic GameStore", "ĐÃ HẾT HẠN THUÊ",
                $"Đơn thuê {r.Code} ({r.GameName}) đã hết hạn. Moxic sẽ thu hồi tài khoản trong thời gian sớm nhất.",
                "Muốn chơi tiếp? Gia hạn ngay trong mục \"Game đang thuê\" trước khi tài khoản được thu hồi.");
        }
    }

    private async Task SafeSend(IEmailService email, string to, string subject, string title, params string[] lines)
    {
        if (string.IsNullOrWhiteSpace(to)) return;
        try { await email.SendNoticeAsync(to, subject, title, lines); }
        catch (Exception ex) { _logger.LogWarning(ex, "Rental email to {to} failed", to); }
    }
}
