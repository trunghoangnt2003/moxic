using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public record OrderStatusResult(bool Ok, string? Error, bool NotFound = false);

/// <summary>
/// The one place order status changes happen (admin panel and Telegram buttons): transition rules,
/// loyalty points, coupon release, customer notification + email, and refreshing the Telegram order cards.
/// </summary>
public class OrderStatusService
{
    private readonly MoxicDbContext _db;
    private readonly PointsService _points;
    private readonly CouponService _coupons;
    private readonly NotificationService _notifications;
    private readonly IBackgroundEmailQueue _emailQueue;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<OrderStatusService> _logger;

    public OrderStatusService(MoxicDbContext db, PointsService points, CouponService coupons, NotificationService notifications,
        IBackgroundEmailQueue emailQueue, IServiceScopeFactory scopes, ILogger<OrderStatusService> logger)
    {
        _db = db;
        _points = points;
        _coupons = coupons;
        _notifications = notifications;
        _emailQueue = emailQueue;
        _scopes = scopes;
        _logger = logger;
    }

    public static bool IsValidTransition(OrderStatus from, OrderStatus to) => (from, to) switch
    {
        (OrderStatus.Pending, OrderStatus.Verifying) => true,
        (OrderStatus.Pending, OrderStatus.Cancelled) => true,
        (OrderStatus.AwaitingConfirmation, OrderStatus.Verifying) => true,
        (OrderStatus.AwaitingConfirmation, OrderStatus.Cancelled) => true,
        (OrderStatus.Verifying, OrderStatus.Installing) => true,
        (OrderStatus.Verifying, OrderStatus.ActionRequired) => true,
        (OrderStatus.Verifying, OrderStatus.Cancelled) => true,
        (OrderStatus.ActionRequired, OrderStatus.Verifying) => true,
        (OrderStatus.ActionRequired, OrderStatus.Cancelled) => true,
        (OrderStatus.Installing, OrderStatus.Completed) => true,
        (OrderStatus.Installing, OrderStatus.Verifying) => true,
        _ => false
    };

    /// <summary>Installing sub-step: logged into the customer's Xbox, the game is now downloading.</summary>
    public async Task<OrderStatusResult> MarkDownloadingAsync(Guid id)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return new(false, "Không tìm thấy đơn hàng", true);
        if (order.Status != OrderStatus.Installing) return new(false, "Đơn chưa ở bước cài đặt");
        if (order.DownloadingAt != null) return new(true, null);
        order.DownloadingAt = DateTime.UtcNow;
        order.UpdatedAt = order.DownloadingAt.Value;
        await _db.SaveChangesAsync();

        var customerId = await _notifications.ResolveOrderCustomerAsync(order);
        if (customerId != null)
            await _notifications.AddAsync(customerId, "order", $"⬇️ Đang tải game cho đơn {order.OrderCode}",
                "Moxic đã đăng nhập Xbox của bạn và đang tải game. Sắp xong rồi!", $"/account/orders/{order.OrderCode}");
        TelegramOrderNotifier.RefreshInBackground(_scopes, order.Id, _logger);
        return new(true, null);
    }

    public async Task<OrderStatusResult> ChangeAsync(Guid id, OrderStatus newStatus, string? reason)
    {
        var order = await _db.Orders.Include(o => o.Details).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return new(false, "Không tìm thấy đơn hàng", true);

        var currentStatus = order.Status;
        if (!IsValidTransition(currentStatus, newStatus))
            return new(false, $"Không thể chuyển từ {currentStatus} sang {newStatus}");
        if (order.IsGift && order.GiftClaimedAt == null && newStatus == OrderStatus.Installing)
            return new(false, "Đơn quà tặng: người nhận chưa nhập tài khoản Xbox");

        // Preorder check: chỉ chặn đánh dấu hoàn thành nếu game chưa phát hành
        if (currentStatus == OrderStatus.Installing && newStatus == OrderStatus.Completed)
        {
            var gameIds = order.Details.Select(d => d.GameId).ToList();
            var hasPreorderNotReleased = await _db.Games
                .AnyAsync(g => gameIds.Contains(g.Id) && g.Status == GameStatus.Preorder && g.ReleaseDate > DateTime.UtcNow);
            if (hasPreorderNotReleased)
                return new(false, "Đơn hàng pre-order chưa đến ngày phát hành, không thể đánh dấu hoàn thành");
        }

        order.Status = newStatus;
        order.UpdatedAt = DateTime.UtcNow;
        // Live-tracking milestones
        switch (newStatus)
        {
            case OrderStatus.Verifying:
                order.PaidAt ??= order.UpdatedAt;
                order.InstallStartedAt = null;
                order.DownloadingAt = null;
                break;
            case OrderStatus.Installing:
                order.InstallStartedAt = order.UpdatedAt;
                order.DownloadingAt = null;
                break;
            case OrderStatus.Completed:
                order.CompletedAt = order.UpdatedAt;
                break;
        }
        if (newStatus == OrderStatus.Cancelled && !string.IsNullOrWhiteSpace(reason))
            order.CancellationReason = reason;

        // Status change + loyalty points credit commit together (points exactly once per order).
        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            await _db.SaveChangesAsync();
            if (newStatus == OrderStatus.Completed)
            {
                var awarded = await _points.AwardForCompletedOrderAsync(order);
                if (awarded > 0)
                    _logger.LogInformation("Credited {Points} loyalty points for order {OrderCode}", awarded, order.OrderCode);
            }
            if (newStatus == OrderStatus.Cancelled)
            {
                // Coupon usage is returned exactly once, in the same transaction as the cancel.
                if (await _coupons.ReleaseForOrderAsync(order.Id))
                    _logger.LogInformation("Released coupon redemption for cancelled order {OrderCode}", order.OrderCode);
            }
            await tx.CommitAsync();
        }

        // In-app notification for the customer's bell.
        var customerId = await _notifications.ResolveOrderCustomerAsync(order);
        var en = order.Lang == "en";
        if (customerId != null)
        {
            var (title, body) = en ? newStatus switch
            {
                OrderStatus.Verifying => ($"Payment received for order {order.OrderCode}", "Moxic is verifying it and getting ready to install your game."),
                OrderStatus.Installing => ($"🔐 Moxic is signing in to Xbox for order {order.OrderCode}", "Please don't sign in to your Xbox account during the install."),
                OrderStatus.ActionRequired => ($"Order {order.OrderCode} needs your action", reason ?? "The Xbox account details aren't correct — please check them."),
                OrderStatus.Completed => ($"🎉 Order {order.OrderCode} is complete", "The game has been installed on your Xbox account. Have fun!"),
                OrderStatus.Cancelled => ($"Order {order.OrderCode} was cancelled", reason ?? "Contact Moxic if you need help."),
                _ => (null as string, null as string),
            } : newStatus switch
            {
                OrderStatus.Verifying => ($"Đã nhận thanh toán đơn {order.OrderCode}", "Moxic đang xác minh và chuẩn bị cài đặt game cho bạn."),
                OrderStatus.Installing => ($"🔐 Moxic đang đăng nhập Xbox cho đơn {order.OrderCode}", "Vui lòng không đăng nhập tài khoản Xbox trong lúc cài đặt."),
                OrderStatus.ActionRequired => ($"Đơn {order.OrderCode} cần bạn xử lý", reason ?? "Thông tin tài khoản Xbox chưa chính xác — vui lòng kiểm tra."),
                OrderStatus.Completed => ($"🎉 Đơn {order.OrderCode} đã hoàn tất", "Game đã được cài vào tài khoản Xbox của bạn. Chúc bạn chơi vui!"),
                OrderStatus.Cancelled => ($"Đơn {order.OrderCode} đã bị hủy", reason ?? "Liên hệ Moxic nếu bạn cần hỗ trợ."),
                _ => (null as string, null as string),
            };
            if (title != null)
                await _notifications.AddAsync(customerId, "order", title, body, $"/account/orders/{order.OrderCode}");
        }

        // Email notification — sent in background
        var _newStatus = newStatus;
        var _customerEmail = order.CustomerXboxEmail;
        var _orderCode = order.OrderCode;
        var _gameName = order.Details.FirstOrDefault()?.GameName ?? "Game";
        var _reason = reason;
        var _en = en;
        _emailQueue.Enqueue(async (sf, ct) =>
        {
            using var scope = sf.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
            try
            {
                switch (_newStatus)
                {
                    case OrderStatus.Verifying:
                        await svc.SendPaymentConfirmedAsync(_customerEmail, _orderCode, _en);
                        break;
                    case OrderStatus.Completed:
                        await svc.SendGameInstalledAsync(_customerEmail, _orderCode, _gameName, _en);
                        break;
                    case OrderStatus.Cancelled:
                        await svc.SendOrderCancelledAsync(_customerEmail, _orderCode, _reason ?? (_en ? "No reason given" : "Không có lý do"), _en);
                        break;
                    case OrderStatus.ActionRequired:
                        await svc.SendActionRequiredAsync(_customerEmail, _orderCode,
                            _en ? "The Xbox account details are incorrect. Please update them." : "Thông tin tài khoản Xbox không chính xác. Vui lòng cập nhật.", _en);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send status notification for order {code}", _orderCode);
            }
        });

        TelegramOrderNotifier.RefreshInBackground(_scopes, order.Id, _logger);
        return new(true, null);
    }
}
