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
    private readonly IConfiguration _config;

    public OrdersController(
        MoxicDbContext db,
        IMinioService minio,
        IDataProtectionProvider dataProtection,
        IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _dataProtection = dataProtection;
        _config = config;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest(new { error = "Gi\u1ecf h\u00e0ng tr\u1ed1ng" });
        if (string.IsNullOrWhiteSpace(request.CustomerPhone))
            return BadRequest(new { error = "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng" });
        if (string.IsNullOrWhiteSpace(request.CustomerXboxEmail))
            return BadRequest(new { error = "Email Xbox kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng" });
        if (string.IsNullOrWhiteSpace(request.CustomerXboxPassword))
            return BadRequest(new { error = "M\u1eadt kh\u1ea9u Xbox kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng" });

        // Generate order code: MOXIC-YYYYMMDD-XXXXX
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var randomPart = Guid.NewGuid().ToString("N")[..5].ToUpper();
        var orderCode = $"MOXIC-{datePart}-{randomPart}";

        // Encrypt Xbox password
        var protector = _dataProtection.CreateProtector("XboxPassword");
        var encryptedPassword = Convert.ToBase64String(protector.Protect(
            System.Text.Encoding.UTF8.GetBytes(request.CustomerXboxPassword)));

        // Calculate total
        var totalAmount = request.Items.Sum(i => i.Price);

        // Parse payment method
        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            paymentMethod = PaymentMethod.Bank;

        // Create order
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

        // Create order details with game name snapshots
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

        return CreatedAtAction(nameof(GetOrder), new { orderCode = order.OrderCode },
            new CreateOrderResponse
            {
                Id = order.Id,
                OrderCode = order.OrderCode,
                TotalAmount = order.TotalAmount,
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
            return NotFound(new { error = "Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng" });

        // Get payment config for QR URLs
        var paymentConfig = await _db.PaymentConfigs.FirstOrDefaultAsync();
        PaymentConfigInfo? paymentInfo = null;

        if (paymentConfig != null)
        {
            var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

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
                CryptoQrUrl = cryptoQrUrl
            };
        }

        return Ok(new OrderConfirmationResponse
        {
            OrderCode = order.OrderCode,
            Items = order.Details.Select(d => new OrderConfirmationItem
            {
                GameName = d.GameName,
                Price = d.Price
            }).ToList(),
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            PaymentConfig = paymentInfo
        });
    }
}
