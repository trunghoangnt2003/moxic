using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection;
using Moxic.Api.Models;
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

    public OrdersController(
        MoxicDbContext db,
        IMinioService minio,
        IDataProtectionProvider dataProtection,
        IConfiguration config,
        IEmailService emailService,
        ILogger<OrdersController> logger,
        IBackgroundEmailQueue emailQueue)
    {
        _db = db;
        _minio = minio;
        _dataProtection = dataProtection;
        _emailService = emailService;
        _logger = logger;
        _emailQueue = emailQueue;
        _config = config;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest(new { error = "Giỏ hàng trống" });
        if (string.IsNullOrWhiteSpace(request.CustomerPhone))
            return BadRequest(new { error = "Số điện thoại không được để trống" });
        if (string.IsNullOrWhiteSpace(request.CustomerXboxEmail))
            return BadRequest(new { error = "Email Xbox không được để trống" });
        if (string.IsNullOrWhiteSpace(request.CustomerXboxPassword))
            return BadRequest(new { error = "Mật khẩu Xbox không được để trống" });

        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var randomPart = Guid.NewGuid().ToString("N")[..5].ToUpper();
        var orderCode = $"MOXIC-{datePart}-{randomPart}";

        var protector = _dataProtection.CreateProtector("XboxPassword");
        var encryptedPassword = Convert.ToBase64String(protector.Protect(
            System.Text.Encoding.UTF8.GetBytes(request.CustomerXboxPassword)));

        var totalAmount = request.Items.Sum(i => i.Price);

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            paymentMethod = PaymentMethod.Bank;

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerPhone = request.CustomerPhone,
            CustomerXboxEmail = request.CustomerXboxEmail,
            CustomerXboxPasswordEncrypted = encryptedPassword,
            CustomerZalo = request.CustomerZalo,
            TotalAmount = totalAmount,
            Status = OrderStatus.Pending,
            PaymentMethod = paymentMethod,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Orders.Add(order);

        var gameIds = request.Items.Select(i => i.GameId).ToList();
        var games = await _db.Games.Where(g => gameIds.Contains(g.Id)).ToListAsync();
        var gameMap = games.ToDictionary(g => g.Id, g => g.Name);

        foreach (var item in request.Items)
        {
            var gameName = gameMap.GetValueOrDefault(item.GameId, "Unknown Game");
            _db.OrderDetails.Add(new OrderDetail
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                GameId = item.GameId,
                GameName = gameName,
                Price = item.Price
            });
        }

        await _db.SaveChangesAsync();

            // NOTF-03: Notify admin of new order
            var _orderCode = order.OrderCode;
            var _phone = order.CustomerPhone;
            var _total = order.TotalAmount;
            _emailQueue.Enqueue(async (sf, ct) =>
            {
                using var scope = sf.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                await svc.SendNewOrderNotificationToAdminAsync(_orderCode, _phone, _total);
            });

        return CreatedAtAction(nameof(GetOrder), new { orderCode = order.OrderCode },
            new CreateOrderResponse { Id = order.Id, OrderCode = order.OrderCode, TotalAmount = order.TotalAmount, CreatedAt = order.CreatedAt });
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
            Items = order.Details.Select(d => new OrderConfirmationItem { GameName = d.GameName, Price = d.Price }).ToList(),
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            PaymentProofUrl = paymentProofUrl,
            PaymentConfig = paymentInfo
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

        return Ok(new PaymentProofUploadResponse
        {
            OrderCode = order.OrderCode,
            Status = order.Status.ToString()
        });
    }
}
