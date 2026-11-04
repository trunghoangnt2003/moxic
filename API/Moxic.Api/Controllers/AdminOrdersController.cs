using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

[Route("api/admin/orders")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminOrdersController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IDataProtectionProvider _dataProtection;
    private readonly IMinioService _minio;
    private readonly IEmailService _emailService;
    private readonly IBackgroundEmailQueue _emailQueue;
    private readonly ILogger<AdminOrdersController> _logger;
    private readonly IConfiguration _config;
    private readonly PointsService _points;
    private readonly CouponService _coupons;
    private readonly NotificationService _notifications;

    public AdminOrdersController(
        MoxicDbContext db,
        IDataProtectionProvider dataProtection,
        IMinioService minio,
        IEmailService emailService,
        IBackgroundEmailQueue emailQueue,
        ILogger<AdminOrdersController> logger,
        IConfiguration config,
        PointsService points,
        CouponService coupons,
        NotificationService notifications)
    {
        _coupons = coupons;
        _notifications = notifications;
        _db = db;
        _dataProtection = dataProtection;
        _minio = minio;
        _emailService = emailService;
        _emailQueue = emailQueue;
        _logger = logger;
        _config = config;
        _points = points;
    }

    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Orders
            .Include(o => o.Details)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var statusFilter))
            query = query.Where(o => o.Status == statusFilter);

        if (fromDate.HasValue)
            query = query.Where(o => o.CreatedAt >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(o => o.CreatedAt <= toDate.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(o => o.OrderCode.Contains(search) || o.CustomerPhone.Contains(search));

        var totalCount = await query.CountAsync();

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = new List<AdminOrderListItem>();
        foreach (var order in orders)
        {
            var gameIds = order.Details.Select(d => d.GameId).ToList();
            var preorderGames = await _db.Games
                .Where(g => gameIds.Contains(g.Id) && g.Status == GameStatus.Preorder && g.ReleaseDate > DateTime.UtcNow)
                .ToListAsync();

            items.Add(new AdminOrderListItem
            {
                IsGift = order.IsGift,
                GiftClaimed = order.GiftClaimedAt != null,
                Id = order.Id,
                OrderCode = order.OrderCode,
                CustomerPhone = order.CustomerPhone,
                TotalAmount = order.TotalAmount,
                DiscountAmount = order.DiscountAmount,
                CouponCode = order.CouponCode,
                Status = order.Status.ToString(),
                PaymentMethod = order.PaymentMethod.ToString(),
                ItemCount = order.Details.Count,
                IsPreorder = preorderGames.Count > 0,
                ReleaseDate = preorderGames.FirstOrDefault()?.ReleaseDate,
                CreatedAt = order.CreatedAt
            });
        }

        return Ok(new AdminOrderListResponse { Items = items, TotalCount = totalCount, Page = page, PageSize = pageSize });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOrderDetail(Guid id)
    {
        var order = await _db.Orders
            .Include(o => o.Details)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound(new { error = "Không tìm thấy đơn hàng" });

        var protector = _dataProtection.CreateProtector("XboxPassword");
        string decryptedPassword;
        if (order.IsGift && string.IsNullOrEmpty(order.CustomerXboxPasswordEncrypted))
            decryptedPassword = "(chờ người nhận quà nhập)";
        else try
        {
            decryptedPassword = System.Text.Encoding.UTF8.GetString(
                protector.Unprotect(Convert.FromBase64String(order.CustomerXboxPasswordEncrypted)));
        }
        catch
        {
            decryptedPassword = "*** Lỗi giải mã ***";
        }

        // Payment proof URL
        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        string? paymentProofUrl = null;
        if (!string.IsNullOrEmpty(order.PaymentProofObjectKey))
            paymentProofUrl = await _minio.GetPresignedUrlAsync(gamesBucket, order.PaymentProofObjectKey, expiry);

        return Ok(new AdminOrderDetailResponse
        {
            IsGift = order.IsGift,
            GiftFromName = order.GiftFromName,
            GiftRecipientName = order.GiftRecipientName,
            GiftMessage = order.GiftMessage,
            GiftRecipientPhone = order.GiftRecipientPhone,
            GiftClaimedAt = order.GiftClaimedAt,
            GiftToken = order.GiftToken,
            Id = order.Id,
            OrderCode = order.OrderCode,
            CustomerPhone = order.CustomerPhone,
            CustomerXboxEmail = order.CustomerXboxEmail,
            CustomerXboxPassword = decryptedPassword,
            CustomerZalo = order.CustomerZalo,
            TotalAmount = order.TotalAmount,
            SubtotalAmount = order.TotalAmount + order.DiscountAmount,
            DiscountAmount = order.DiscountAmount,
            CouponCode = order.CouponCode,
            Status = order.Status.ToString(),
            PaymentMethod = order.PaymentMethod.ToString(),
            Notes = order.Notes,
            Items = order.Details.Select(d => new AdminOrderDetailItem { GameName = d.GameName, Price = d.Price }).ToList(),
            PaymentProofUrl = paymentProofUrl,
            CancellationReason = order.CancellationReason,
            IsClientConfirmed = order.IsClientConfirmed,
            ClientConfirmedAt = order.ClientConfirmedAt,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt
        });
    }

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateOrderStatus(Guid id, [FromBody] UpdateOrderStatusRequest request)
    {
        var order = await _db.Orders
            .Include(o => o.Details)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound(new { error = "Không tìm thấy đơn hàng" });

        if (!Enum.TryParse<OrderStatus>(request.Status, true, out var newStatus))
            return BadRequest(new { error = $"Trạng thái không hợp lệ: {request.Status}" });

        var currentStatus = order.Status;

        bool validTransition = (currentStatus, newStatus) switch
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

        if (!validTransition)
            return BadRequest(new { error = $"Không thể chuyển từ {currentStatus} sang {newStatus}" });
        if (order.IsGift && order.GiftClaimedAt == null && newStatus == OrderStatus.Installing)
            return BadRequest(new { error = "Đơn quà tặng: người nhận chưa nhập tài khoản Xbox" });

        // Preorder check: chỉ chặn đánh dấu hoàn thành nếu game chưa phát hành
        if (currentStatus == OrderStatus.Installing && newStatus == OrderStatus.Completed)
        {
            var gameIds = order.Details.Select(d => d.GameId).ToList();
            var hasPreorderNotReleased = await _db.Games
                .AnyAsync(g => gameIds.Contains(g.Id) && g.Status == GameStatus.Preorder && g.ReleaseDate > DateTime.UtcNow);

            if (hasPreorderNotReleased)
                return BadRequest(new { error = "Đơn hàng pre-order chưa đến ngày phát hành, không thể đánh dấu hoàn thành" });
        }

        order.Status = newStatus;
        order.UpdatedAt = DateTime.UtcNow;

        // Save rejection reason
        if (newStatus == OrderStatus.Cancelled && !string.IsNullOrWhiteSpace(request.Reason))
            order.CancellationReason = request.Reason;

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
                OrderStatus.ActionRequired => ($"Đơn {order.OrderCode} cần bạn xử lý", request.Reason ?? "Thông tin tài khoản Xbox chưa chính xác — vui lòng kiểm tra."),
                OrderStatus.Completed => ($"🎉 Đơn {order.OrderCode} đã hoàn tất", "Game đã được cài vào tài khoản Xbox của bạn. Chúc bạn chơi vui!"),
                OrderStatus.Cancelled => ($"Đơn {order.OrderCode} đã bị hủy", request.Reason ?? "Liên hệ Moxic nếu bạn cần hỗ trợ."),
                _ => (null as string, null as string),
            };
            if (title != null)
                await _notifications.AddAsync(customerId, "order", title, body, $"/account/orders/{order.OrderCode}");
        }

        // Enqueue email notification ? sent in background
        var _newStatus = newStatus;
        var _customerEmail = order.CustomerXboxEmail;
        var _orderCode = order.OrderCode;
        var _gameName = order.Details.FirstOrDefault()?.GameName ?? "Game";
        var _reason = request.Reason;
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

        return NoContent();
    }
}
