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

    public async Task SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount, decimal discountAmount = 0, string? couponCode = null)
    {
        var discountHtml = string.Empty;
        if (discountAmount > 0)
        {
            var subtotal = totalAmount + discountAmount;
            discountHtml = $"<p>Tạm tính: {subtotal:N0}đ</p><p>Giảm giá ({System.Net.WebUtility.HtmlEncode(couponCode ?? string.Empty)}): -{discountAmount:N0}đ</p>";
        }
        await SendAsync(_settings.AdminEmail, "Đơn hàng mới — Moxic GameStore",
            $"<h1 style=\"color:#f97316\">ĐƠN HÀNG MỚI</h1><p>Mã: {orderCode}</p><p>SDT: {customerPhone}</p>{discountHtml}<p>Tiền: {totalAmount:N0}đ</p>");
    }

    private static string L(bool en, string vi, string english) => en ? english : vi;
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    public async Task SendPaymentConfirmedAsync(string toEmail, string orderCode, bool en = false)
    {
        await SendAsync(toEmail, L(en, "Đã nhận thanh toán — Moxic GameStore", "Payment received — Moxic GameStore"),
            $"<h1 style=\"color:#22c55e\">{L(en, "THANH TOÁN THÀNH CÔNG", "PAYMENT RECEIVED")}</h1><p>{L(en, "Cảm ơn bạn. Đang cài game (15-30 phút).", "Thank you. We're installing your game (15–30 minutes).")}</p><p>{L(en, "Mã", "Order")}: {E(orderCode)}</p>");
    }

    public async Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName, bool en = false)
    {
        await SendAsync(toEmail, L(en, "Game đã cài đặt — Moxic GameStore", "Your game is installed — Moxic GameStore"),
            $"<h1 style=\"color:#22c55e\">{L(en, "CÀI ĐẶT HOÀN TẤT", "INSTALL COMPLETE")}</h1><p>{(en ? $"<strong>{E(gameName)}</strong> has been installed on your Xbox account. Have fun!" : $"Game <strong>{E(gameName)}</strong> đã cài vào tài khoản Xbox.")}</p><p>{L(en, "Mã", "Order")}: {E(orderCode)}</p>");
    }

    public async Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason, bool en = false)
    {
        await SendAsync(toEmail, L(en, "Đơn hàng đã hủy — Moxic GameStore", "Order cancelled — Moxic GameStore"),
            $"<h1 style=\"color:#dc2626\">{L(en, "ĐƠN HÀNG ĐÃ HỦY", "ORDER CANCELLED")}</h1><p>{L(en, "Mã", "Order")}: {E(orderCode)}</p><p>{L(en, "Lý do", "Reason")}: {E(reason)}</p>");
    }

    public async Task SendActionRequiredAsync(string toEmail, string orderCode, string message, bool en = false)
    {
        await SendAsync(toEmail, L(en, "Cần cập nhật thông tin — Moxic GameStore", "Action needed — Moxic GameStore"),
            $"<h1 style=\"color:#f97316\">{L(en, "CẦN XỬ LÝ", "ACTION NEEDED")}</h1><p>{L(en, "Mã", "Order")}: {E(orderCode)}</p><p>{E(message)}</p>");
    }

    public async Task SendEmailVerificationCodeAsync(string toEmail, string displayName, string code, bool en = false)
    {
        var subject = L(en, "Mã xác minh email — Moxic GameStore", "Your email verification code — Moxic GameStore");
        if (!IsConfigured)
        {
            // Dev fallback: SMTP is not configured, so surface the code in the log instead of crashing.
            _logger.LogWarning("SMTP chưa được cấu hình — mã xác minh email cho {to}: {code}", toEmail, code);
            return;
        }

        var name = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(displayName) ? L(en, "bạn", "there") : displayName);
        await SendAsync(toEmail, subject, BuildCodeEmail(
            L(en, "XÁC MINH EMAIL", "VERIFY YOUR EMAIL"),
            en
                ? $"Hi <strong>{name}</strong>,</p><p>Thanks for signing up for Moxic GameStore. Enter the code below to verify your email:"
                : $"Xin chào <strong>{name}</strong>,</p><p>Cảm ơn bạn đã đăng ký tài khoản Moxic GameStore. Nhập mã dưới đây để xác minh email của bạn:",
            code,
            null,
            en));
    }

    public async Task SendPasswordResetCodeAsync(string toEmail, string code, bool en = false)
    {
        var subject = L(en, "Mã đặt lại mật khẩu — Moxic GameStore", "Your password reset code — Moxic GameStore");
        if (!IsConfigured)
        {
            _logger.LogWarning("SMTP chưa được cấu hình — mã đặt lại mật khẩu cho {to}: {code}", toEmail, code);
            return;
        }

        await SendAsync(toEmail, subject, BuildCodeEmail(
            L(en, "ĐẶT LẠI MẬT KHẨU", "RESET YOUR PASSWORD"),
            L(en, "Xin chào,</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Moxic GameStore của bạn. Nhập mã dưới đây để tiếp tục:",
                "Hi,</p><p>We received a request to reset the password of your Moxic GameStore account. Enter the code below to continue:"),
            code,
            L(en, "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.", "If you didn't ask to reset your password, you can ignore this email."),
            en));
    }

    private static string BuildCodeEmail(string heading, string introHtml, string code, string? footerNote, bool en = false)
    {
        var footer = footerNote == null ? string.Empty : $"<p style=\"color:#7a6f63;font-size:13px\">{footerNote}</p>";
        return $"<div style=\"font-family:Arial,sans-serif;background:#1a1714;color:#ede6db;padding:24px\">"
            + $"<h1 style=\"color:#c9a96e;letter-spacing:2px\">{heading}</h1>"
            + $"<p>{introHtml}</p>"
            + $"<p style=\"font-size:32px;font-weight:bold;letter-spacing:10px;color:#c9a96e;margin:24px 0\">{WebUtility.HtmlEncode(code)}</p>"
            + $"<p>{L(en, "Mã có hiệu lực trong 15 phút. Không chia sẻ mã này với bất kỳ ai.", "The code is valid for 15 minutes. Don't share it with anyone.")}</p>"
            + footer
            + "</div>";
    }

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.Host)
        && !string.IsNullOrWhiteSpace(_settings.Username)
        && !string.IsNullOrWhiteSpace(_settings.Password);

    public Task SendNoticeAsync(string toEmail, string subject, string title, params string[] paragraphs)
    {
        var body = $"<h1 style=\"color:#d4a853\">{WebUtility.HtmlEncode(title)}</h1>"
                   + string.Concat(paragraphs.Select(p => $"<p>{WebUtility.HtmlEncode(p)}</p>"));
        return SendAsync(toEmail, subject, body);
    }

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
