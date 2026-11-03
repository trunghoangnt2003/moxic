using System.Net;
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

    public async Task SendEmailVerificationCodeAsync(string toEmail, string displayName, string code)
    {
        const string subject = "Mã xác minh email — Moxic GameStore";
        if (!IsConfigured)
        {
            // Dev fallback: SMTP is not configured, so surface the code in the log instead of crashing.
            _logger.LogWarning("SMTP chưa được cấu hình — mã xác minh email cho {to}: {code}", toEmail, code);
            return;
        }

        var name = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(displayName) ? "bạn" : displayName);
        await SendAsync(toEmail, subject, BuildCodeEmail(
            "XÁC MINH EMAIL",
            $"Xin chào <strong>{name}</strong>,</p><p>Cảm ơn bạn đã đăng ký tài khoản Moxic GameStore. Nhập mã dưới đây để xác minh email của bạn:",
            code,
            null));
    }

    public async Task SendPasswordResetCodeAsync(string toEmail, string code)
    {
        const string subject = "Mã đặt lại mật khẩu — Moxic GameStore";
        if (!IsConfigured)
        {
            _logger.LogWarning("SMTP chưa được cấu hình — mã đặt lại mật khẩu cho {to}: {code}", toEmail, code);
            return;
        }

        await SendAsync(toEmail, subject, BuildCodeEmail(
            "ĐẶT LẠI MẬT KHẨU",
            "Xin chào,</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Moxic GameStore của bạn. Nhập mã dưới đây để tiếp tục:",
            code,
            "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này."));
    }

    private static string BuildCodeEmail(string heading, string introHtml, string code, string? footerNote)
    {
        var footer = footerNote == null ? string.Empty : $"<p style=\"color:#7a6f63;font-size:13px\">{footerNote}</p>";
        return $"<div style=\"font-family:Arial,sans-serif;background:#1a1714;color:#ede6db;padding:24px\">"
            + $"<h1 style=\"color:#c9a96e;letter-spacing:2px\">{heading}</h1>"
            + $"<p>{introHtml}</p>"
            + $"<p style=\"font-size:32px;font-weight:bold;letter-spacing:10px;color:#c9a96e;margin:24px 0\">{WebUtility.HtmlEncode(code)}</p>"
            + "<p>Mã có hiệu lực trong 15 phút. Không chia sẻ mã này với bất kỳ ai.</p>"
            + footer
            + "</div>";
    }

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.Host)
        && !string.IsNullOrWhiteSpace(_settings.Username)
        && !string.IsNullOrWhiteSpace(_settings.Password);

    private async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning("SMTP chưa được cấu hình — bỏ qua email {subject} tới {to}", subject, to);
            return;
        }

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
