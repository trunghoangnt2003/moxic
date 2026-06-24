using Microsoft.Extensions.DependencyInjection;
using Moxic.Core.Interfaces;
using System.Threading.Channels;

namespace Moxic.Api.Services;

public class BackgroundEmailQueue : IBackgroundEmailQueue
{
    private readonly Channel<Func<IServiceScopeFactory, CancellationToken, Task>> _channel;

    public BackgroundEmailQueue()
    {
        _channel = Channel.CreateBounded<Func<IServiceScopeFactory, CancellationToken, Task>>(100);
    }

    public void Enqueue(Func<IServiceScopeFactory, CancellationToken, Task> emailTask)
    {
        _channel.Writer.TryWrite(emailTask);
    }

    public async Task<Func<IServiceScopeFactory, CancellationToken, Task>> DequeueAsync(CancellationToken ct)
    {
        return await _channel.Reader.ReadAsync(ct);
    }
}
