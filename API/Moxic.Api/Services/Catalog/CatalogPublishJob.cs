using System.Collections.Concurrent;

namespace Moxic.Api.Services.Catalog;

public record PublishStatus(bool Running, int Total, int Done, int Published, string? Current, List<string> Errors, DateTime? StartedAt, DateTime? FinishedAt);

/// <summary>
/// Publishes review-queue games in the background, one at a time (each copies its Xbox images into MinIO). The admin can
/// keep queuing while it runs; queued games are hidden from the review list. Progress is polled by the admin widget.
/// </summary>
public class CatalogPublishJob
{
    private const int MaxErrors = 50;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<CatalogPublishJob> _logger;
    private readonly ConcurrentQueue<Guid> _queue = new();
    private readonly ConcurrentDictionary<Guid, byte> _queued = new();
    private readonly object _gate = new();
    private readonly List<string> _errors = new();
    private bool _running;
    private int _total, _done, _published;
    private string? _current;
    private DateTime? _startedAt, _finishedAt;

    public CatalogPublishJob(IServiceScopeFactory scopes, ILogger<CatalogPublishJob> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    public PublishStatus Status
    {
        get { lock (_gate) return new(_running, _total, _done, _published, _current, _errors.ToList(), _startedAt, _finishedAt); }
    }

    public bool IsQueued(Guid id) => _queued.ContainsKey(id);
    public IReadOnlyCollection<Guid> QueuedIds => _queued.Keys.ToList();

    public PublishStatus Enqueue(IEnumerable<Guid> ids)
    {
        var start = false;
        lock (_gate)
        {
            if (!_running)
            {
                _total = _done = _published = 0;
                _errors.Clear();
                _current = null;
                _startedAt = DateTime.UtcNow;
                _finishedAt = null;
            }
            foreach (var id in ids.Distinct())
                if (_queued.TryAdd(id, 0)) { _queue.Enqueue(id); _total++; }
            if (!_running && _total > 0) { _running = true; start = true; }
        }
        if (start) _ = Task.Run(RunAsync);
        return Status;
    }

    private async Task RunAsync()
    {
        while (true)
        {
            Guid id;
            lock (_gate)
            {
                if (!_queue.TryDequeue(out id))
                {
                    _running = false;
                    _current = null;
                    _finishedAt = DateTime.UtcNow;
                    return;
                }
            }
            try
            {
                using var scope = _scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<CatalogImportService>();
                lock (_gate) _current = svc.NameOf(id);
                var errors = await svc.PublishAsync(new[] { id }, CancellationToken.None);
                lock (_gate)
                {
                    if (errors.Count == 0) _published++;
                    else AddError(errors[0].Error);
                }
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Publishing game {Game} failed", id);
                lock (_gate) AddError($"{_current ?? id.ToString()}: {e.Message}");
            }
            finally
            {
                _queued.TryRemove(id, out _);
                lock (_gate) _done++;
            }
        }
    }

    private void AddError(string message)
    {
        if (_errors.Count < MaxErrors) _errors.Add(message);
    }
}
