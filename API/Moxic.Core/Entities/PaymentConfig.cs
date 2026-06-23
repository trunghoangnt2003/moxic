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

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Not mapped — computed at API layer
    [NotMapped]
    public string? BankQrPresignedUrl { get; set; }

    [NotMapped]
    public string? CryptoQrPresignedUrl { get; set; }
}
