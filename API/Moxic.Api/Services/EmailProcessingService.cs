using Moxic.Core.Interfaces;

namespace Moxic.Api.Services;

public class EmailProcessingService : BackgroundService
{
    private readonly IBackgroundEmailQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailProcessingService> _logger;

    public EmailProcessingService(IBackgroundEmailQueue queue, IServiceScopeFactory scopeFactory, ILogger<EmailProcessingService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("EmailProcessingService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var emailTask = await _queue.DequeueAsync(stoppingToken);
                await emailTask(_scopeFactory, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Email processing error"); }
        }
    }
}
