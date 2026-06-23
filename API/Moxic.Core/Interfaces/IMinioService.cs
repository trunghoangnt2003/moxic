namespace Moxic.Core.Interfaces;

public interface IMinioService
{
    Task<string> UploadImageAsync(string bucket, string objectKey, Stream fileStream, string contentType);
    Task<string> GetPresignedUrlAsync(string bucket, string objectKey, int expiryHours = 1);
    Task DeleteObjectAsync(string bucket, string objectKey);
}
