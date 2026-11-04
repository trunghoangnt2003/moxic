using System.ComponentModel.DataAnnotations.Schema;

namespace Moxic.Core.Entities;

public class PaymentConfig
{
    public int Id { get; set; }

    // Bank QR
    public string BankBucketName { get; set; } = "moxic-config";
    public string BankQrObjectKey { get; set; } = string.Empty;

    // Crypto QR
    public string? CryptoBucketName { get; set; }
    public string? CryptoQrObjectKey { get; set; }

    // Transfer syntax
    public string TransferSyntaxTemplate { get; set; } = "MOXIC {OrderCode}";

    // Bank account info
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;

    /// <summary>VietQR bank id (e.g. "MB", "VCB", "TCB" or the 6-digit BIN). Enables per-order QR with amount + content.</summary>
    public string? BankCode { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Not mapped — computed at API layer
    [NotMapped]
    public string? BankQrPresignedUrl { get; set; }

    [NotMapped]
    public string? CryptoQrPresignedUrl { get; set; }
}
