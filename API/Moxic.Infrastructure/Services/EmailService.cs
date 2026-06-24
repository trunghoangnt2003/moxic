using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moxic.Core.Interfaces;

namespace Moxic.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly ILogger<EmailService> _logger;
    private readonly SmtpSettings _settings;

    public EmailService(ILogger<EmailService> logger, IOptions<SmtpSettings> settings)
    {
        _logger = logger;
        _settings = settings.Value;
    }

    public async Task SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount)
    {
        await SendAsync(_settings.AdminEmail, "Đơn hàng mới — Moxic GameStore",
            $"<h1 style=\"color:#f97316\">ĐƠN HÀNG MỚI</h1><p>Mã: {orderCode}</p><p>SDT: {customerPhone}</p><p>Tiền: {totalAmount:N0}đ</p>");
    }

    public async Task SendPaymentConfirmedAsync(string toEmail, string orderCode)
    {
        await SendAsync(toEmail, "Đã nhận thanh toán — Moxic GameStore",
            $"<h1 style=\"color:#22c55e\">THANH TOÁN THÀNH CÔNG</h1><p>Cảm ơn bạn. Đang cài game (15-30 phút).</p><p>Mã: {orderCode}</p>");
    }

    public async Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName)
    {
        await SendAsync(toEmail, "Game đã cài đặt — Moxic GameStore",
            $"<h1 style=\"color:#22c55e\">CÀI ĐẶT HOÀN TẤT</h1><p>Game <strong>{gameName}</strong> đã cài vào tài khoản Xbox.</p><p>Mã: {orderCode}</p>");
    }

    public async Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason)
    {
        await SendAsync(toEmail, "Đơn hàng đã hủy — Moxic GameStore",
            $"<h1 style=\"color:#dc2626\">ĐƠN HÀNG ĐÃ HỦY</h1><p>Mã: {orderCode}</p><p>Lý do: {reason}</p>");
    }

    public async Task SendActionRequiredAsync(string toEmail, string orderCode, string message)
    {
        await SendAsync(toEmail, "Cần cập nhật thông tin — Moxic GameStore",
            $"<h1 style=\"color:#f97316\">CẦN XỬ LÝ</h1><p>Mã: {orderCode}</p><p>{message}</p>");
    }

    private async Task SendAsync(string to, string subject, string htmlBody)
    {
        try
        {
            var msg = new MimeMessage();
            msg.From.Add(new MailboxAddress("Moxic GameStore", _settings.Username));
            msg.To.Add(new MailboxAddress("", to));
            msg.Subject = subject;
            msg.Body = new TextPart("html") { Text = htmlBody };

            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.Username, _settings.Password);
            await client.SendAsync(msg);
            await client.DisconnectAsync(true);

            _logger.LogInformation("Email sent to {to}: {subj}", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {to}: {subj}", to, subject);
        }
    }
}

public class SmtpSettings
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
}
