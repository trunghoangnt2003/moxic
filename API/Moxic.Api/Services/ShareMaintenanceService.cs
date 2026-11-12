namespace Moxic.Api.Services;

/// <summary>Runs share-room deadlines (48h pay window, 12h reminder, 7-day expiry) every 5 minutes.</summary>
public class ShareMaintenanceService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ShareMaintenanceService> _logger;

    public ShareMaintenanceService(IServiceScopeFactory scopes, ILogger<ShareMaintenanceService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let startup (schema bootstrap) finish first.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch (OperationCanceledException) { return; }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var changed = await scope.ServiceProvider.GetRequiredService<ShareRoomService>().RunMaintenanceAsync(DateTime.UtcNow);
                if (changed > 0) _logger.LogInformation("Share maintenance changed {Count} rooms", changed);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Share maintenance failed");
            }
            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }
}
