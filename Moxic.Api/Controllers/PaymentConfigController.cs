using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PaymentConfigController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public PaymentConfigController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    // GET /api/payment-config/active — public, for checkout display
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveConfig()
    {
        var config = await _db.PaymentConfigs.FirstOrDefaultAsync();
        if (config == null)
            return NotFound("Payment config not set up yet");

        var configBucket = _config.GetValue<string>("Minio:ConfigBucket")!;
        var gamesBucket = _config.GetValue<string>("Minio:GamesBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        string? bankQrUrl = null;
        string? cryptoQrUrl = null;

        if (!string.IsNullOrEmpty(config.BankQrObjectKey))
            bankQrUrl = await _minio.GetPresignedUrlAsync(config.BankBucketName, config.BankQrObjectKey, expiry);

        if (!string.IsNullOrEmpty(config.CryptoQrObjectKey))
            cryptoQrUrl = await _minio.GetPresignedUrlAsync(config.CryptoBucketName ?? configBucket, config.CryptoQrObjectKey, expiry);

        return Ok(new
        {
            config.TransferSyntaxTemplate,
            BankQrUrl = bankQrUrl,
            CryptoQrUrl = cryptoQrUrl
        });
    }
}
