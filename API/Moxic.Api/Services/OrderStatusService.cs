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
        if (customerId != null)
        {
            var (title, body) = newStatus switch
            {
                OrderStatus.Verifying => ($"Đã nhận thanh toán đơn {order.OrderCode}", "Moxic đang xác minh và chuẩn bị cài đặt game cho bạn."),
                OrderStatus.Installing => ($"Đơn {order.OrderCode} đang được cài đặt", "Vui lòng không đăng nhập tài khoản Xbox trong lúc cài đặt."),
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
        _emailQueue.Enqueue(async (sf, ct) =>
        {
            using var scope = sf.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
            try
            {
                switch (_newStatus)
                {
                    case OrderStatus.Verifying:
                        await svc.SendPaymentConfirmedAsync(_customerEmail, _orderCode);
                        break;
                    case OrderStatus.Completed:
                        await svc.SendGameInstalledAsync(_customerEmail, _orderCode, _gameName);
                        break;
                    case OrderStatus.Cancelled:
                        await svc.SendOrderCancelledAsync(_customerEmail, _orderCode, _reason ?? "Không có lý do");
                        break;
                    case OrderStatus.ActionRequired:
                        await svc.SendActionRequiredAsync(_customerEmail, _orderCode,
                            "Thông tin tài khoản Xbox không chính xác. Vui lòng cập nhật.");
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
