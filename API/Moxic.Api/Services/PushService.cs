using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using WebPush;

namespace Moxic.Api.Services;

/// <summary>
/// Web Push (VAPID). Keys come from Push:PublicKey/PrivateKey config, else from .keys/vapid.json
/// (the persisted data-protection volume), generated on first use. Sending runs on the background
/// queue so it never slows a request; expired subscriptions (404/410) are deleted.
/// </summary>
public class PushService
{
    private static readonly object KeyLock = new();
    private static VapidDetails? _vapid;

    private readonly IConfiguration _config;
    private readonly IBackgroundEmailQueue _queue;
    private readonly ILogger<PushService> _logger;

    public PushService(IConfiguration config, IBackgroundEmailQueue queue, ILogger<PushService> logger)
    {
        _config = config;
        _queue = queue;
        _logger = logger;
    }

    public VapidDetails Vapid
    {
        get
        {
            if (_vapid != null) return _vapid;
            lock (KeyLock)
            {
                if (_vapid != null) return _vapid;
                var subject = _config["Push:Subject"] ?? "mailto:support@moxic.co";
                var pub = _config["Push:PublicKey"];
                var priv = _config["Push:PrivateKey"];
                if (string.IsNullOrEmpty(pub) || string.IsNullOrEmpty(priv))
                {
                    var path = Path.Combine(AppContext.BaseDirectory, ".keys", "vapid.json");
                    if (!File.Exists(path)) path = Path.Combine(Directory.GetCurrentDirectory(), ".keys", "vapid.json");
                    if (File.Exists(path))
                    {
                        var saved = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
                        pub = saved["publicKey"];
                        priv = saved["privateKey"];
                    }
                    else
                    {
                        var keys = VapidHelper.GenerateVapidKeys();
                        pub = keys.PublicKey;
                        priv = keys.PrivateKey;
                        try
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                            File.WriteAllText(path, JsonSerializer.Serialize(new { publicKey = pub, privateKey = priv }));
                        }
                        catch (Exception ex) { _logger.LogWarning(ex, "Could not persist VAPID keys"); }
                    }
                }
                _vapid = new VapidDetails(subject, pub, priv);
                return _vapid;
            }
        }
    }

    /// <summary>Queues a push to every device of the user.</summary>
    public void Enqueue(string userId, string title, string? body, string? link)
    {
        var vapid = Vapid;
        _queue.Enqueue(async (sf, ct) =>
        {
            using var scope = sf.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
            var subs = await db.WebPushSubscriptions.AsNoTracking().Where(s => s.UserId == userId).ToListAsync(ct);
            if (subs.Count == 0) return;
            var payload = JsonSerializer.Serialize(new { title, body, url = link ?? "/", icon = "/icon-192.png", badge = "/icon-192.png" });
            var client = new WebPushClient();
            foreach (var s in subs)
            {
                try
                {
                    await client.SendNotificationAsync(new PushSubscription(s.Endpoint, s.P256dh, s.Auth), payload, vapid, ct);
                }
                catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
                {
                    await db.WebPushSubscriptions.Where(x => x.Id == s.Id).ExecuteDeleteAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Web push to {Endpoint} failed", s.Endpoint[..Math.Min(40, s.Endpoint.Length)]);
                }
            }
        });
    }
}
