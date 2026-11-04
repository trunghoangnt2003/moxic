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
    private readonly OrderStatusService _statuses;

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
        NotificationService notifications,
        OrderStatusService statuses)
    {
        _statuses = statuses;
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
        if (!Enum.TryParse<OrderStatus>(request.Status, true, out var newStatus))
            return BadRequest(new { error = $"Trạng thái không hợp lệ: {request.Status}" });
        var r = await _statuses.ChangeAsync(id, newStatus, request.Reason);
        if (r.NotFound) return NotFound(new { error = r.Error });
        if (!r.Ok) return BadRequest(new { error = r.Error });
        return NoContent();
    }
}
