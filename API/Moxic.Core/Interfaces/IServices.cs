namespace Moxic.Core.Interfaces;

public interface IEmailService
{
    Task SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount);
    Task SendPaymentConfirmedAsync(string toEmail, string orderCode);
    Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName);
    Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason);
    Task SendActionRequiredAsync(string toEmail, string orderCode, string message);
}
