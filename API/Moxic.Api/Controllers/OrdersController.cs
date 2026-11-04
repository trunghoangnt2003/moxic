using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class OrdersController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IDataProtectionProvider _dataProtection;
    private readonly ILogger<OrdersController> _logger;
    private readonly IEmailService _emailService;
    private readonly IBackgroundEmailQueue _emailQueue;
    private readonly IConfiguration _config;
    private readonly CouponService _coupons;

    public OrdersController(
        MoxicDbContext db,
        IMinioService minio,
        IDataProtectionProvider dataProtection,
        IConfiguration config,
        IEmailService emailService,
        ILogger<OrdersController> logger,
        IBackgroundEmailQueue emailQueue,
        CouponService coupons)
    {
        _coupons = coupons;
        _db = db;
        _minio = minio;
        _dataProtection = dataProtection;
        _emailService = emailService;
        _logger = logger;
        _emailQueue = emailQueue;
        _config = config;
    }

    [HttpPost]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest(new { error = "Giỏ hàng trống" });
        if (string.IsNullOrWhiteSpace(request.CustomerPhone))
            return BadRequest(new { error = "Số điện thoại không được để trống" });
        if (!request.IsGift && string.IsNullOrWhiteSpace(request.CustomerXboxEmail))
            return BadRequest(new { error = "Email Xbox không được để trống" });
        if (!request.IsGift && string.IsNullOrWhiteSpace(request.CustomerXboxPassword))
            return BadRequest(new { error = "Mật khẩu Xbox không được để trống" });
        if (request.IsGift && string.IsNullOrWhiteSpace(request.GiftRecipientName))
            return BadRequest(new { error = "Nhập tên người nhận quà" });

        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var randomPart = Guid.NewGuid().ToString("N")[..5].ToUpper();
        var orderCode = $"MOXIC-{datePart}-{randomPart}";

        var protector = _dataProtection.CreateProtector("XboxPassword");
        // Gift orders carry no Xbox credentials until the recipient claims the gift.
        var encryptedPassword = request.IsGift ? string.Empty : Convert.ToBase64String(protector.Protect(
            System.Text.Encoding.UTF8.GetBytes(request.CustomerXboxPassword)));

        // Link the order to the logged-in customer (separate MoxicCustomer scheme); guests stay unlinked.
        string? customerId = null;
        var customerAuth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        if (customerAuth.Succeeded && customerAuth.Principal != null
            && customerAuth.Principal.IsInRole(CustomerAuthRules.CustomerRole))
        {
            customerId = customerAuth.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        // Coupons require login (one coupon per order).
        var couponCode = string.IsNullOrWhiteSpace(request.CouponCode) ? null : request.CouponCode;
        if (couponCode != null && string.IsNullOrEmpty(customerId))
            return BadRequest(new { error = CouponRules.MsgLoginRequired, code = CouponRules.ErrLoginRequired });

        // Server-side pricing from Game.SalePrice — the client Price is ignored (T-smv-01).
        var (lines, cartError) = await _coupons.PriceLinesAsync(request.Items.Select(i => (i.GameId, i.EditionId)).ToList());
        if (lines == null) return BadRequest(new { error = cartError });
        var subtotal = lines.Sum(l => l.Price);

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            paymentMethod = PaymentMethod.Bank;

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerPhone = request.CustomerPhone,
            CustomerXboxEmail = request.IsGift ? string.Empty : request.CustomerXboxEmail.Trim(),
            CustomerXboxPasswordEncrypted = encryptedPassword,
            CustomerZalo = request.CustomerZalo,
            TotalAmount = subtotal,
            DiscountAmount = 0m,
            Status = OrderStatus.Pending,
            PaymentMethod = paymentMethod,
            CustomerId = customerId,
            IsGift = request.IsGift,
            GiftToken = request.IsGift ? GiftRules.NewToken() : null,
            GiftFromName = request.IsGift ? GiftRules.Clean(request.GiftFromName, 60) : null,
            GiftRecipientName = request.IsGift ? GiftRules.Clean(request.GiftRecipientName, 60) : null,
            GiftMessage = request.IsGift ? GiftRules.Clean(request.GiftMessage, 300) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            _db.Orders.Add(order);
            foreach (var line in lines)
            {
                _db.OrderDetails.Add(new OrderDetail
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    GameId = line.GameId,
                    GameName = line.GameName,
                    Price = line.Price,
                    ListPrice = line.ListPrice,
                    EditionId = line.EditionId,
                    EditionName = line.EditionName
                });
            }

            if (couponCode != null)
            {
                // Re-validates every rule and claims a use atomically inside this transaction.
                var (eval, coupon) = await _coupons.RedeemAsync(customerId!, couponCode, lines, order.Id);
                if (!eval.Ok || coupon == null)
                {
                    await tx.RollbackAsync();
                    _db.ChangeTracker.Clear();
                    return BadRequest(new { error = eval.Error ?? CouponRules.MsgNotFound, code = eval.ErrorCode ?? CouponRules.ErrNotFound });
                }
                order.CouponId = coupon.Id;
                order.CouponCode = coupon.Code;
                order.DiscountAmount = eval.DiscountAmount;
                order.TotalAmount = subtotal - eval.DiscountAmount;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }

            // NOTF-03: Notify admin of new order
            var _orderCode = order.OrderCode;
            var _phone = order.CustomerPhone;
            var _total = order.TotalAmount;
            var _discount = order.DiscountAmount;
            var _couponCode = order.CouponCode;
            _emailQueue.Enqueue(async (sf, ct) =>
            {
                using var scope = sf.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                await svc.SendNewOrderNotificationToAdminAsync(_orderCode, _phone, _total, _discount, _couponCode);
            });

        TelegramOrderNotifier.NotifyInBackground(HttpContext.RequestServices.GetRequiredService<IServiceScopeFactory>(), order.Id,
            order.IsGift ? "🛒🎁 Đơn quà tặng mới" : "🛒 Đơn mới", log: _logger);

        return CreatedAtAction(nameof(GetOrder), new { orderCode = order.OrderCode },
            new CreateOrderResponse
            {
                Id = order.Id,
                OrderCode = order.OrderCode,
                TotalAmount = order.TotalAmount,
                DiscountAmount = order.DiscountAmount,
                CouponCode = order.CouponCode,
                CreatedAt = order.CreatedAt
            });
    }

    [HttpGet("{orderCode}")]
    public async Task<IActionResult> GetOrder(string orderCode)
    {
        var order = await _db.Orders
            .Include(o => o.Details)
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode);

        if (order == null)
            return NotFound(new { error = "Không tìm thấy đơn hàng" });

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        // Payment proof URL
        string? paymentProofUrl = null;
        if (!string.IsNullOrEmpty(order.PaymentProofObjectKey))
            paymentProofUrl = await _minio.GetPresignedUrlAsync(gamesBucket, order.PaymentProofObjectKey, expiry);

        var paymentConfig = await _db.PaymentConfigs.FirstOrDefaultAsync();
        PaymentConfigInfo? paymentInfo = null;

        if (paymentConfig != null)
        {
            string? bankQrUrl = null;
            string? cryptoQrUrl = null;

            if (!string.IsNullOrEmpty(paymentConfig.BankQrObjectKey))
                bankQrUrl = await _minio.GetPresignedUrlAsync(
                    paymentConfig.BankBucketName, paymentConfig.BankQrObjectKey, expiry);

            if (!string.IsNullOrEmpty(paymentConfig.CryptoQrObjectKey))
                cryptoQrUrl = await _minio.GetPresignedUrlAsync(
                    paymentConfig.CryptoBucketName ?? paymentConfig.BankBucketName,
                    paymentConfig.CryptoQrObjectKey, expiry);

            paymentInfo = new PaymentConfigInfo
            {
                TransferSyntaxTemplate = paymentConfig.TransferSyntaxTemplate,
                BankQrUrl = bankQrUrl,
                CryptoQrUrl = cryptoQrUrl,
                BankName = paymentConfig.BankName,
                BankAccountNumber = paymentConfig.BankAccountNumber,
                BankAccountHolder = paymentConfig.BankAccountHolder
            };
        }

        return Ok(new OrderConfirmationResponse
        {
            OrderCode = order.OrderCode,
            Items = order.Details.Select(d => new OrderConfirmationItem { GameName = d.GameName, Price = d.Price, ListPrice = d.ListPrice }).ToList(),
            TotalAmount = order.TotalAmount,
            SubtotalAmount = order.TotalAmount + order.DiscountAmount,
            DiscountAmount = order.DiscountAmount,
            CouponCode = order.CouponCode,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            PaymentProofUrl = paymentProofUrl,
            PaymentConfig = paymentInfo,
            IsGift = order.IsGift,
            GiftToken = order.GiftToken,
            GiftRecipientName = order.GiftRecipientName,
            GiftClaimedAt = order.GiftClaimedAt,
            TransferContent = BankPaymentService.TransferContent(order.OrderCode),
            DynamicQrUrl = BankPaymentService.VietQrUrl(paymentConfig, order.TotalAmount, BankPaymentService.TransferContent(order.OrderCode)),
            AutoConfirm = !string.IsNullOrWhiteSpace(_config["Sepay:ApiKey"]),
            SavedAmount = OrderSavings.Saved(order.Details.Select(d => (d.Price, d.ListPrice)), order.DiscountAmount),
            PaidAt = order.PaidAt,
            InstallStartedAt = order.InstallStartedAt,
            DownloadingAt = order.DownloadingAt,
            CompletedAt = order.CompletedAt
        });
    }

    // POST /api/orders/{orderCode}/proof
    [HttpPost("{orderCode}/proof")]
    public async Task<IActionResult> UploadProof(string orderCode, IFormFile file)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.OrderCode == orderCode);
        if (order == null)
            return NotFound(new { error = "Không tìm thấy đơn hàng" });

        if (order.Status != OrderStatus.Pending)
            return BadRequest(new { error = "Đơn hàng không ở trạng thái chờ thanh toán" });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "File không được để trống" });
        if (file.Length > 50 * 1024 * 1024)
            return BadRequest(new { error = "File quá lớn (tối đa 50MB)" });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedTypes = new[] { ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".gif", ".tiff", ".tif" };
        if (!allowedTypes.Contains(ext))
            return BadRequest(new { error = "Chỉ chấp nhận file ảnh" });

        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var objectKey = $"proofs/{orderCode}/{Guid.NewGuid()}{ext}";

        using var stream = file.OpenReadStream();
        await _minio.UploadImageAsync(gamesBucket, objectKey, stream, file.ContentType);

        order.PaymentProofObjectKey = objectKey;
        order.Status = OrderStatus.AwaitingConfirmation;
        order.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var scopes = HttpContext.RequestServices.GetRequiredService<IServiceScopeFactory>();
        TelegramOrderNotifier.RefreshInBackground(scopes, order.Id, _logger);
        TelegramOrderNotifier.NotifyInBackground(scopes, order.Id, "📸 Khách đã gửi ảnh chuyển khoản", withProof: true, log: _logger);

        return Ok(new PaymentProofUploadResponse
        {
            OrderCode = order.OrderCode,
            Status = order.Status.ToString()
        });
    }
}
