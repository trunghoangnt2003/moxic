# Phase 5: Notifications & Polish — Research

> **Prepared:** 2026-06-24
> **Status:** Complete
> **Source:** Inline research (no subagent)

## Research Areas

### 1. Resend .NET SDK

**Package:** `Resend` on NuGet (v4.x)

**Key Findings:**
- NuGet package `Resend` provides `IResendClient` interface with `EmailSendAsync()` method
- Registration: `builder.Services.AddResend(options => { options.ApiKey = config["Resend:ApiKey"]; })`
- Sending: `await resend.EmailSendAsync(new EmailMessage { From = "...", To = "...", Subject = "...", HtmlBody = "..." })`
- Supports HTML body, plain text, attachments, reply-to, CC/BCC
- Rate limits: Resend free tier allows 100 emails/day, 3 emails/second
- API key stored in appsettings.json or environment variable

**Integration Pattern:**
```csharp
// Program.cs
builder.Services.AddResend(options => {
    options.ApiKey = builder.Configuration["Resend:ApiKey"]!;
});

// EmailService
public class EmailService : IEmailService
{
    private readonly IResendClient _resend;
    public EmailService(IResendClient resend) => _resend = resend;
    
    public async Task SendOrderConfirmationAsync(string to, string orderCode)
    {
        var html = await RenderTemplateAsync("OrderConfirmation", new { OrderCode = orderCode });
        await _resend.EmailSendAsync(new EmailMessage
        {
            From = "Moxic GameStore <noreply@moxic.com>",
            To = to,
            Subject = "Đơn hàng đã xác nhận — Moxic GameStore",
            HtmlBody = html
        });
    }
}
```

### 2. Polly Retry — Exponential Backoff

**Package:** `Polly.Core` on NuGet (v8.x, .NET 10 compatible)

**Key Findings:**
- Polly v8 uses pipeline-based API: `ResiliencePipeline`
- Pattern: `new ResiliencePipelineBuilder().AddRetry(new RetryStrategyOptions { MaxRetryAttempts = 3, Delay = TimeSpan.FromSeconds(2), BackoffType = DelayBackoffType.Exponential }).Build()`
- Backoff: 2s → 4s → 8s (exponential)
- `OnRetry` callback for logging failed attempts
- Register as singleton: `builder.Services.AddResiliencePipeline("email-retry", builder => builder.AddRetry(...))`

**Integration:**
```csharp
// In EmailService
private readonly ResiliencePipeline _retryPipeline;

public EmailService(IResendClient resend)
{
    _resend = resend;
    _retryPipeline = new ResiliencePipelineBuilder()
        .AddRetry(new RetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            Delay = TimeSpan.FromSeconds(2),
            BackoffType = DelayBackoffType.Exponential,
            OnRetry = args =>
            {
                _logger.LogWarning("Email send failed (attempt {n}): {msg}", args.AttemptNumber, args.Outcome.Exception?.Message);
                return ValueTask.CompletedTask;
            }
        })
        .Build();
}

public async Task SendEmailAsync(EmailMessage msg)
{
    await _retryPipeline.ExecuteAsync(async ct => await _resend.EmailSendAsync(msg, ct));
}
```

### 3. IHostedService — Payment Timeout Background Job

**Key Findings:**
- `BackgroundService` abstract class: override `ExecuteAsync(CancellationToken)`
- Timer pattern: `while (!stoppingToken.IsCancellationRequested) { await Task.Delay(interval, stoppingToken); ... }`
- Recommended interval: 15-30 minutes (configurable)
- Query: `_db.Orders.Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < DateTime.UtcNow.AddHours(-24))`
- Auto-cancel: set Status to Cancelled, set CancellationReason, call IEmailService
- Must scope DbContext (transient) — BackgroundService is singleton

**Pattern:**
```csharp
public class PaymentTimeoutService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(_checkInterval, stoppingToken);
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var expired = await db.Orders
                .Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < DateTime.UtcNow.AddHours(-24))
                .ToListAsync(stoppingToken);
            foreach (var order in expired)
            {
                order.Status = OrderStatus.Cancelled;
                order.CancellationReason = "Hết hạn thanh toán sau 24 giờ";
                order.UpdatedAt = DateTime.UtcNow;
                await email.SendCancellationAsync(order.CustomerXboxEmail, order.OrderCode, order.CancellationReason);
            }
            await db.SaveChangesAsync(stoppingToken);
        }
    }
}
```

### 4. FluentEmail.Razor — Email Templates

**Key Findings:**
- Package: `FluentEmail.Razor` (uses RazorLight under the hood)
- Templates stored as `.cshtml` files in `Moxic.Api/Emails/Templates/`
- Registration: `builder.Services.AddFluentEmail("noreply@moxic.com", "Moxic GameStore").AddRazorRenderer()`
- Rendering: `var html = await _templateRenderer.RenderAsync("OrderConfirmation.cshtml", model)`
- Alternative: Since Resend already sends HTML directly, could use simple string interpolation or RazorLight directly instead of FluentEmail
- Simpler approach for this project: use Resend SDK directly with raw HTML strings or minimal RazorLight — avoids adding FluentEmail complexity
- **Recommendation:** Use `RazorLight` directly (already embedded in FluentEmail.Razor) or build HTML templates with interpolated strings for Phase 5. Given the small number of templates (4-5), string interpolation with HTML partials is sufficient and avoids another NuGet dependency.

### 5. Frontend — UI Polish Patterns

**Skeleton Screens:**
- Existing `Skeleton.tsx` already has `HeroSkeleton` — extend with `GameCardSkeleton`, `OrderListSkeleton`, `DetailSkeleton`
- Pattern: pulsing divs with `animate-pulse` + `bg-gray-800/50` matching component dimensions
- No library needed — pure Tailwind CSS

**Toast Notifications:**
- Options: `react-hot-toast` (lightweight, 5.6kB), `sonner` (modern, 4kB), or custom with Tailwind
- **Recommendation:** `react-hot-toast` — simple API, lightweight, Epic-style dark theme compatible
- Usage: `toast.success("Game added to cart!", { action: { label: "View Cart", onClick: () => navigate("/cart") } })`

**Empty States:**
- Custom components per context (cart, search, orders)
- lucide-react icons (already installed): `ShoppingBag`, `SearchX`, `Package`
- Pattern: centered flexbox with icon + text + action button

**404 Page:**
- New route in App.tsx with `path="*"`  — catch-all
- Custom branded page with game-themed illustration
- Uses same dark theme as rest of storefront

## Package Changes Summary

| Package | Version | Added To | Purpose |
|---------|---------|----------|---------|
| `Resend` | latest | Moxic.Infrastructure | Transactional email sending |
| `Polly.Core` | latest | Moxic.Infrastructure | Retry with exponential backoff |
| `react-hot-toast` | latest | Moxic.Web | Toast notifications |

## Architecture Flow

```
Order Controller
  → IEmailService (retry via Polly)
    → Resend API (email sent)
    
BackgroundService (timer 15min)
  → Query expired Pending orders
    → Update status to Cancelled
      → IEmailService → Resend API
      
AdminOrdersController (status transition)
  → IEmailService (Verifying/Completed/Cancelled email)
    → Polly retry → Resend API
```

**No FluentEmail needed** — Resend SDK handles HTML email directly, Polly handles retry. Keeping dependency count minimal.

