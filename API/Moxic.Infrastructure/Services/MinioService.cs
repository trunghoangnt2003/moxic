using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Moxic.Core.Interfaces;

namespace Moxic.Infrastructure.Services;

public class MinioService : IMinioService
{
    private readonly IMinioClient _minioClient;
    private readonly MinioSettings _settings;

    public MinioService(IMinioClient minioClient, IOptions<MinioSettings> settings)
    {
        _minioClient = minioClient;
        _settings = settings.Value;
    }

    public async Task<string> UploadImageAsync(string bucket, string objectKey, Stream fileStream, string contentType)
    {
        var putArgs = new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType);

        await _minioClient.PutObjectAsync(putArgs);
        return objectKey;
    }

    public async Task<string> GetPresignedUrlAsync(string bucket, string objectKey, int expiryHours = 1)
    {
        if (objectKey.StartsWith("http")) return objectKey;
        
        var args = new PresignedGetObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithExpiry(expiryHours * 3600);

        var url = await _minioClient.PresignedGetObjectAsync(args);
        // Replace internal Docker hostname with public endpoint
        var internalEndpoint = $"{_settings.Endpoint}";
        if (!string.IsNullOrEmpty(internalEndpoint) && url.Contains(internalEndpoint))
        {
            url = url.Replace(internalEndpoint, _settings.PublicEndpoint);
        }
        // Also handle protocol mismatch (internal http, public https)
        if (_settings.WithSSL && url.StartsWith("http://"))
        {
            url = url.Replace("http://", "https://");
        }
        return url;
    }

    public async Task DeleteObjectAsync(string bucket, string objectKey)
    {
        var args = new RemoveObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey);

        await _minioClient.RemoveObjectAsync(args);
    }
}

public class MinioSettings
{
    public string Endpoint { get; set; } = "localhost:9000";
    public string AccessKey { get; set; } = "moxicadmin";
    public string SecretKey { get; set; } = "moxic123456";
    public bool WithSSL { get; set; } = false;
    public string GamesBucket { get; set; } = "moxic-games";
    public string ConfigBucket { get; set; } = "moxic-config";
    public int PresignedUrlExpiryHours { get; set; } = 1;
    public string PublicEndpoint { get; set; } = "localhost:9000";
}
