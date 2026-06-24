using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Api.Models;

namespace Moxic.Api.Controllers;

[Route("api/admin/payment-config")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminPaymentConfigController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public AdminPaymentConfigController(MoxicDbContext db, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetConfig()
    {
        var config = await _db.PaymentConfigs.FirstOrDefaultAsync();
        if (config == null) return Ok(new PaymentConfig());

        var configBucket = _config.GetValue<string>("Minio:ConfigBucket")!;
        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");

        if (!string.IsNullOrEmpty(config.BankQrObjectKey))
            config.BankQrPresignedUrl = await _minio.GetPresignedUrlAsync(config.BankBucketName, config.BankQrObjectKey, expiry);
        if (!string.IsNullOrEmpty(config.CryptoQrObjectKey))
            config.CryptoQrPresignedUrl = await _minio.GetPresignedUrlAsync(config.CryptoBucketName ?? configBucket, config.CryptoQrObjectKey, expiry);

        return Ok(config);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateConfig([FromBody] UpdatePaymentConfigDto dto)
    {
        var config = await _db.PaymentConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new PaymentConfig();
            _db.PaymentConfigs.Add(config);
        }

        config.TransferSyntaxTemplate = dto.TransferSyntaxTemplate ?? config.TransferSyntaxTemplate;
        if (dto.BankName != null) config.BankName = dto.BankName;
        if (dto.BankAccountNumber != null) config.BankAccountNumber = dto.BankAccountNumber;
        if (dto.BankAccountHolder != null) config.BankAccountHolder = dto.BankAccountHolder;
        config.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(config);
    }

    [HttpPost("bank-qr")]
    public async Task<IActionResult> UploadBankQr(IFormFile file)
    {
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024)
            return BadRequest("Invalid file");

        var configBucket = _config.GetValue<string>("Minio:ConfigBucket")!;
        var objectKey = $"config/bank-qr{Path.GetExtension(file.FileName)}";

        using var stream = file.OpenReadStream();
        await _minio.UploadImageAsync(configBucket, objectKey, stream, file.ContentType);

        var config = await _db.PaymentConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new PaymentConfig();
            _db.PaymentConfigs.Add(config);
        }

        config.BankBucketName = configBucket;
        config.BankQrObjectKey = objectKey;
        config.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        var presignedUrl = await _minio.GetPresignedUrlAsync(configBucket, objectKey, expiry);
        return Ok(new { ObjectKey = objectKey, PresignedUrl = presignedUrl });
    }

    [HttpPost("crypto-qr")]
    public async Task<IActionResult> UploadCryptoQr(IFormFile file)
    {
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024)
            return BadRequest("Invalid file");

        var configBucket = _config.GetValue<string>("Minio:ConfigBucket")!;
        var objectKey = $"config/crypto-qr{Path.GetExtension(file.FileName)}";

        using var stream = file.OpenReadStream();
        await _minio.UploadImageAsync(configBucket, objectKey, stream, file.ContentType);

        var config = await _db.PaymentConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new PaymentConfig();
            _db.PaymentConfigs.Add(config);
        }

        config.CryptoBucketName = configBucket;
        config.CryptoQrObjectKey = objectKey;
        config.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var expiry = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        var presignedUrl = await _minio.GetPresignedUrlAsync(configBucket, objectKey, expiry);
        return Ok(new { ObjectKey = objectKey, PresignedUrl = presignedUrl });
    }
}
