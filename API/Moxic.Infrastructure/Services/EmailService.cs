using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;
using Resend;
using Moxic.Core.Interfaces;

namespace Moxic.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IResend _resend;
    private readonly ILogger<EmailService> _logger;
    private readonly string _adminEmail;
    private readonly ResiliencePipeline _retryPipeline;

    public EmailService(IResend resend, ILogger<EmailService> logger, IOptions<EmailSettings> settings)
    {
        _resend = resend;
        _logger = logger;
        _adminEmail = settings.Value.AdminEmail;

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromSeconds(2),
                BackoffType = DelayBackoffType.Exponential,
                OnRetry = args =>
                {
                    _logger.LogWarning("Email send failed (attempt {n}): {err}",
                        args.AttemptNumber, args.Outcome.Exception?.Message);
                    return ValueTask.CompletedTask;
                }
            })
            .Build();
    }

    public async Task SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount)
    {
        var subject = "Đơn hàng mới — Moxic GameStore";
        var html = $@"
<html><body style=""background:#121212;color:#f4f4f5;font-family:Inter,sans-serif;padding:32px"">
<h1 style=""color:#f97316;font-family:'Russo One',sans-serif"">ĐƠN HÀNG MỚI</h1>
<table style=""width:100%;border-collapse:collapse;margin-top:16px"">
<tr><td style=""padding:8px;border:1px solid #3f3f46;color:#a1a1aa"">Mã đơn</td><td style=""padding:8px;border:1px solid #3f3f46;color:#f4f4f5;font-weight:bold"">{orderCode}</td></tr>
<tr><td style=""padding:8px;border:1px solid #3f3f46;color:#a1a1aa"">SĐT</td><td style=""padding:8px;border:1px solid #3f3f46;color:#f4f4f5"">{customerPhone}</td></tr>
<tr><td style=""padding:8px;border:1px solid #3f3f46;color:#a1a1aa"">Tổng tiền</td><td style=""padding:8px;border:1px solid #3f3f46;color:#f97316;font-weight:bold"">{totalAmount:N0}đ</td></tr>
</table>
<p style=""margin-top:16px;color:#a1a1aa"">Vào admin để xem và xử lý đơn hàng.</p>
</body></html>";
        await SendWithRetryAsync(_adminEmail, subject, html);
    }

    public async Task SendPaymentConfirmedAsync(string toEmail, string orderCode)
    {
        var subject = "Đã nhận thanh toán — Moxic GameStore";
        var html = $@"
<html><body style=""background:#121212;color:#f4f4f5;font-family:Inter,sans-serif;padding:32px"">
<h1 style=""color:#22c55e;font-family:'Russo One',sans-serif"">THANH TOÁN THÀNH CÔNG</h1>
<p>Cảm ơn bạn đã thanh toán. Chúng tôi đang tiến hành cài đặt game cho tài khoản Xbox của bạn.</p>
<p style=""color:#a1a1aa;margin-top:16px"">Mã đơn: <strong style=""color:#f4f4f5"">{orderCode}</strong></p>
<p style=""color:#a1a1aa;margin-top:8px"">Thời gian cài đặt dự kiến: 15-30 phút.</p>
</body></html>";
        await SendWithRetryAsync(toEmail, subject, html);
    }

    public async Task SendGameInstalledAsync(string toEmail, string orderCode, string gameName)
    {
        var subject = "Game đã được cài đặt — Moxic GameStore";
        var html = $@"
<html><body style=""background:#121212;color:#f4f4f5;font-family:Inter,sans-serif;padding:32px"">
<h1 style=""color:#22c55e;font-family:'Russo One',sans-serif"">CÀI ĐẶT HOÀN TẤT</h1>
<p>Game <strong style=""color:#f97316"">{gameName}</strong> đã được cài đặt vào tài khoản Xbox của bạn.</p>
<p style=""color:#a1a1aa;margin-top:16px"">Mã đơn: <strong style=""color:#f4f4f5"">{orderCode}</strong></p>
<p style=""color:#a1a1aa;margin-top:8px"">Đăng nhập Xbox để kiểm tra và bắt đầu chơi! Nếu gặp vấn đề, liên hệ qua Zalo/FB.</p>
</body></html>";
        await SendWithRetryAsync(toEmail, subject, html);
    }

    public async Task SendOrderCancelledAsync(string toEmail, string orderCode, string reason)
    {
        var subject = "Đơn hàng đã hủy — Moxic GameStore";
        var html = $@"
<html><body style=""background:#121212;color:#f4f4f5;font-family:Inter,sans-serif;padding:32px"">
<h1 style=""color:#dc2626;font-family:'Russo One',sans-serif"">ĐƠN HÀNG ĐÃ HỦY</h1>
<p>Đơn hàng <strong>{orderCode}</strong> của bạn đã bị hủy.</p>
<p style=""color:#a1a1aa;margin-top:12px"">Lý do: {reason}</p>
<p style=""color:#a1a1aa;margin-top:16px"">Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi qua Zalo/FB.</p>
</body></html>";
        await SendWithRetryAsync(toEmail, subject, html);
    }

    public async Task SendActionRequiredAsync(string toEmail, string orderCode, string message)
    {
        var subject = "Cần cập nhật thông tin — Moxic GameStore";
        var html = $@"
<html><body style=""background:#121212;color:#f4f4f5;font-family:Inter,sans-serif;padding:32px"">
<h1 style=""color:#f97316;font-family:'Russo One',sans-serif"">CẦN XỬ LÝ</h1>
<p>Đơn hàng <strong>{orderCode}</strong> cần được cập nhật thông tin để tiếp tục xử lý.</p>
<p style=""color:#a1a1aa;margin-top:12px"">{message}</p>
<p style=""color:#a1a1aa;margin-top:16px"">Vui lòng cập nhật thông tin tài khoản Xbox của bạn để chúng tôi có thể cài đặt game.</p>
</body></html>";
        await SendWithRetryAsync(toEmail, subject, html);
    }

    private async Task SendWithRetryAsync(string to, string subject, string html)
    {
        try
        {
            await _retryPipeline.ExecuteAsync(async ct =>
            {
                var msg = new EmailMessage
                {
                    From = "Moxic GameStore <onboarding@resend.dev>",
                    To = [to],
                    Subject = subject,
                    HtmlBody = html
                };
                await _resend.EmailSendAsync(msg, ct);
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {to} after 3 retries: {subj}", to, subject);
        }
    }
}

public class EmailSettings
{
    public string AdminEmail { get; set; } = "trungnt260303@gmail.com";
    public string ResendApiKey { get; set; } = string.Empty;
}
