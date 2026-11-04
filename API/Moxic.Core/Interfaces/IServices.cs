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
    // Customer emails: en = true sends the English version (the customer's site language).
    Task SendPaymentConfirmedAsync(string toEmail, string orderCode, bool en = false);
    Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName, bool en = false);
    Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason, bool en = false);
    Task SendActionRequiredAsync(string toEmail, string orderCode, string message, bool en = false);
    Task SendEmailVerificationCodeAsync(string toEmail, string displayName, string code, bool en = false);
    Task SendPasswordResetCodeAsync(string toEmail, string code, bool en = false);
    /// <summary>Simple notice: title + paragraphs (plain text, HTML-encoded by the service).</summary>
    Task SendNoticeAsync(string toEmail, string subject, string title, params string[] paragraphs);
}
