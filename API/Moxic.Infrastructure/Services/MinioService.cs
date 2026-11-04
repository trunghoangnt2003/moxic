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
        // ðŸŸ¢ Tá»° Äá»˜NG KIá»‚M TRA VÃ€ Táº O BUCKET Náº¾U CHÆ¯A Tá»’N Táº I
        var bucketExistsArgs = new BucketExistsArgs().WithBucket(bucket);
        bool bucketExists = await _minioClient.BucketExistsAsync(bucketExistsArgs);
        
        if (!bucketExists)
        {
            // Táº¡o má»›i bucket
            var makeBucketArgs = new MakeBucketArgs().WithBucket(bucket);
            await _minioClient.MakeBucketAsync(makeBucketArgs);

            // THIáº¾T Láº¬P POLICY PUBLIC (READ-ONLY) CHO BUCKET Má»šI Táº O
            // Äiá»u nÃ y giÃºp áº£nh sau khi upload cÃ³ thá»ƒ hiá»ƒn thá»‹ cÃ´ng khai trÃªn giao diá»‡n Web/Admin
            string policyJson = $@"{{
                ""Version"": ""2012-10-17"",
                ""Statement"": [
                    {{
                        ""Sid"": ""PublicRead"",
                        ""Effect"": ""Allow"",
                        ""Principal"": ""*"",
                        ""Action"": [""s3:GetObject""],
                        ""Resource"": [""arn:aws:s3:::{bucket}/*""]
                    }}
                ]
            }}";

            var setPolicyArgs = new SetPolicyArgs()
                .WithBucket(bucket)
                .WithPolicy(policyJson);
            
            await _minioClient.SetPolicyAsync(setPolicyArgs);
        }

        // Thá»±c hiá»‡n upload file nhÆ° cÅ©
        var putArgs = new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType);

        await _minioClient.PutObjectAsync(putArgs);
        return objectKey;
    }

    private static readonly string[] PublicPrefixes = ["games/", "announcements/", "spin-cases/", "spin-music/"];

    public async Task<string> GetPresignedUrlAsync(string bucket, string objectKey, int expiryHours = 1)
	{
		if (string.IsNullOrEmpty(objectKey)) return string.Empty;
		
		// Náº¿u objectKey Ä‘Ã£ lÃ  má»™t link URL hoÃ n chá»‰nh (vÃ­ dá»¥ link áº£nh tá»« bÃªn thá»© 3), tráº£ vá» luÃ´n
		if (objectKey.StartsWith("http://") || objectKey.StartsWith("https://")) 
			return objectKey;
		
		// Public catalog media (unique, never-overwritten keys in the public-read games bucket) get a stable,
		// unsigned URL so browsers and the CDN can cache it for a year. Payment proofs / config QR stay signed.
		if (bucket == _settings.GamesBucket && PublicPrefixes.Any(p => objectKey.StartsWith(p, StringComparison.Ordinal)))
		{
			var host = _settings.PublicEndpoint.Trim().TrimEnd('/');
			var path = string.Join('/', objectKey.Split('/').Select(Uri.EscapeDataString));
			return host.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? $"{host}/{bucket}/{path}" : $"https://{host}/{bucket}/{path}";
		}

		var args = new PresignedGetObjectArgs()
			.WithBucket(bucket)
			.WithObject(objectKey)
			.WithExpiry(expiryHours * 3600);

		// 1. MinIO sinh ra URL ná»™i bá»™ dáº¡ng: http://moxic-minio:9000/moxic-games/filename.jpg?X-Amz-...
		var internalUrl = await _minioClient.PresignedGetObjectAsync(args);
		
		try
		{
			// Sá»­ dá»¥ng class Uri cá»§a .NET Ä‘á»ƒ bÃ³c tÃ¡ch URL má»™t cÃ¡ch khoa há»c, trÃ¡nh dÃ¹ng hÃ m Replace chuá»—i dá»… bá»‹ lá»—i váº·t
			var uriBuilder = new UriBuilder(internalUrl);
			
			// 2. PhÃ¢n tÃ­ch PublicEndpoint tá»« cáº¥u hÃ¬nh (Há»— trá»£ cáº£ IP láº«n Domain)
			// VÃ­ dá»¥ _settings.PublicEndpoint cÃ³ thá»ƒ lÃ  "34.158.54.48:9000" hoáº·c "cdn.moxic.com" hoáº·c "minio.moxic.com:9000"
			string publicHost = _settings.PublicEndpoint;
			int? publicPort = null;

			if (publicHost.Contains(":"))
			{
				var parts = publicHost.Split(':');
				publicHost = parts[0];
				if (int.TryParse(parts[1], out int parsedPort))
				{
					publicPort = parsedPort;
				}
			}

			// 3. ÄÃ¨ Endpoint ná»™i bá»™ báº±ng Endpoint Public (Domain hoáº·c IP Public)
			uriBuilder.Host = publicHost;
			if (publicPort.HasValue)
			{
				uriBuilder.Port = publicPort.Value;
			}
			else
			{
				// Náº¿u dÃ¹ng Domain cháº¡y qua Reverse Proxy (Nginx/Traefik) Ä‘Ã£ áº©n port, ta xÃ³a bá» port máº·c Ä‘á»‹nh cá»§a MinIO Ä‘i
				uriBuilder.Port = 443; 
			}

			// 4. Tá»± Ä‘á»™ng chuyá»ƒn Ä‘á»•i Giao thá»©c (Protocol) dá»±a theo cáº¥u hÃ¬nh WithSSL
			// Náº¿u gáº¯n Domain + cÃ³ SSL mÃ£ hÃ³a -> Ã‰p vá» https. Náº¿u cháº¡y IP thuáº§n khÃ´ng SSL -> Ã‰p vá» http
			uriBuilder.Scheme = "https";

			// Tráº£ vá» URL cuá»‘i cÃ¹ng Ä‘Ã£ Ä‘Æ°á»£c chuáº©n hÃ³a hoÃ n toÃ n
			return uriBuilder.Uri.ToString();
		}
		catch (Exception)
		{
			// Báº£n phÃ²ng thá»§: Náº¿u cÃ³ lá»—i phÃ¢n tÃ­ch cÃº phÃ¡p Uri, tá»± Ä‘á»™ng fallback vá» cÆ¡ cháº¿ thay tháº¿ chuá»—i cÆ¡ báº£n
			var internalEndpoint = $"{_settings.Endpoint}";
			var fallbackUrl = internalUrl;

			if (!string.IsNullOrEmpty(internalEndpoint) && fallbackUrl.Contains(internalEndpoint))
			{
				fallbackUrl = fallbackUrl.Replace(internalEndpoint, _settings.PublicEndpoint);
			}

			if (fallbackUrl.StartsWith("http://"))
				fallbackUrl = fallbackUrl.Replace("http://", "https://");

			return fallbackUrl;
		}
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

