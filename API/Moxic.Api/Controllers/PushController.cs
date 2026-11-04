using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record PushKeys(string? P256dh, string? Auth);
public record PushSubscribeRequest(string? Endpoint, PushKeys? Keys);

/// <summary>Web Push registration for the PWA / browser.</summary>
[Route("api/push")]
[ApiController]
public class PushController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly PushService _push;

    public PushController(MoxicDbContext db, PushService push)
    {
        _db = db;
        _push = push;
    }

    [HttpGet("public-key")]
    public IActionResult PublicKey() => Ok(new { publicKey = _push.Vapid.PublicKey });

    [HttpPost("subscribe")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var endpoint = request.Endpoint?.Trim();
        if (string.IsNullOrEmpty(endpoint) || endpoint.Length > 1000 || !endpoint.StartsWith("https://")
            || string.IsNullOrEmpty(request.Keys?.P256dh) || string.IsNullOrEmpty(request.Keys?.Auth))
            return BadRequest(new { error = "Đăng ký thông báo không hợp lệ." });

        // One row per endpoint; re-subscribing moves it to the current account.
        await _db.WebPushSubscriptions.Where(s => s.Endpoint == endpoint).ExecuteDeleteAsync();
        if (await _db.WebPushSubscriptions.CountAsync(s => s.UserId == userId) >= 10)
            await _db.WebPushSubscriptions.Where(s => s.UserId == userId).OrderBy(s => s.CreatedAt).Take(1).ExecuteDeleteAsync();
        _db.WebPushSubscriptions.Add(new WebPushSubscription
        {
            Id = Guid.NewGuid(), UserId = userId, Endpoint = endpoint,
            P256dh = request.Keys!.P256dh!, Auth = request.Keys.Auth!, CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] PushSubscribeRequest request)
    {
        if (!string.IsNullOrEmpty(request.Endpoint))
            await _db.WebPushSubscriptions.Where(s => s.Endpoint == request.Endpoint).ExecuteDeleteAsync();
        return NoContent();
    }
}
