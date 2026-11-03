using System.Threading.RateLimiting;

namespace Moxic.Api.Services;

/// <summary>
/// Per-user fixed-window limiter for opening account cases (FreeInterval / Points).
/// The ASP.NET rate-limit policy only sees the default auth scheme, and customers use the
/// separate MoxicCustomer scheme, so the controller checks this after authenticating.
/// </summary>
public sealed class SpinUserRateLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<string> _limiter =
        PartitionedRateLimiter.Create<string, string>(userId =>
            RateLimitPartition.GetFixedWindowLimiter(userId, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = LuckySpinRules.OpenPerUserPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    /// <summary>True when the user still has an open permit in the current window.</summary>
    public bool TryAcquire(string userId)
    {
        using var lease = _limiter.AttemptAcquire(userId);
        return lease.IsAcquired;
    }

    public void Dispose() => _limiter.Dispose();
}
