using Microsoft.Extensions.DependencyInjection;

namespace Moxic.Core.Interfaces;

public interface IBackgroundEmailQueue
{
    void Enqueue(Func<IServiceScopeFactory, CancellationToken, Task> emailTask);
    Task<Func<IServiceScopeFactory, CancellationToken, Task>> DequeueAsync(CancellationToken ct);
}

public interface IEmailService
{
    Task SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount, decimal discountAmount = 0, string? couponCode = null);
    Task SendPaymentConfirmedAsync(string toEmail, string orderCode);
    Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName);
    Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason);
    Task SendActionRequiredAsync(string toEmail, string orderCode, string message);
    Task SendEmailVerificationCodeAsync(string toEmail, string displayName, string code);
    Task SendPasswordResetCodeAsync(string toEmail, string code);
}
