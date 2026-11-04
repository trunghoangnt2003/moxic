using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Automatic bank reconciliation: per-order VietQR (amount + content prefilled) and matching incoming
/// transfers (SePay webhook) to orders by the order code in the transfer content.
/// </summary>
public class BankPaymentService
{
    private static readonly Regex CodeInContent = new(@"MOXIC(\d{8})([A-Z0-9]{5})", RegexOptions.Compiled);
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    private readonly MoxicDbContext _db;
    private readonly OrderStatusService _statuses;
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<BankPaymentService> _logger;

    public BankPaymentService(MoxicDbContext db, OrderStatusService statuses, IServiceScopeFactory scopes, IConfiguration config, ILogger<BankPaymentService> logger)
    {
        _db = db;
        _statuses = statuses;
        _scopes = scopes;
        _config = config;
        _logger = logger;
    }

    public bool AutoConfirmEnabled => !string.IsNullOrWhiteSpace(_config["Sepay:ApiKey"]);

    /// <summary>Transfer content for an order: the code without dashes (some banks strip "-").</summary>
    public static string TransferContent(string orderCode) => orderCode.Replace("-", "").ToUpperInvariant();

    public static string? VietQrUrl(PaymentConfig? cfg, decimal amount, string content)
    {
        if (cfg == null || string.IsNullOrWhiteSpace(cfg.BankCode) || string.IsNullOrWhiteSpace(cfg.BankAccountNumber)) return null;
        // SePay's QR generator (standard VietQR/NAPAS payload — any banking app can scan it).
        var acc = Regex.Replace(cfg.BankAccountNumber, @"\s", "");
        return $"https://qr.sepay.vn/img?acc={Uri.EscapeDataString(acc)}&bank={Uri.EscapeDataString(cfg.BankCode.Trim())}" +
               $"&amount={Math.Round(amount, 0).ToString(CultureInfo.InvariantCulture)}&des={Uri.EscapeDataString(content)}&template=compact";
    }

    /// <summary>"…mb moxic20261104513e6 ft…" → "MOXIC-20261104-513E6".</summary>
    public static string? FindOrderCode(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var normalized = Regex.Replace(content.ToUpperInvariant(), "[^A-Z0-9]", "");
        var m = CodeInContent.Match(normalized);
        return m.Success ? $"MOXIC-{m.Groups[1].Value}-{m.Groups[2].Value}" : null;
    }

    private static string Vnd(decimal v) => v.ToString("N0", Vi) + "đ";

    /// <summary>
    /// Records one incoming transfer (idempotent by provider txn id) and settles the matching order.
    /// Returns false when this transaction was already processed.
    /// </summary>
    public async Task<bool> HandleIncomingAsync(string provider, string txnId, decimal amount, string? content, string? gateway,
        string? account, string? reference, DateTime? date)
    {
        if (await _db.BankTransactions.AnyAsync(t => t.Provider == provider && t.ProviderTxnId == txnId)) return false;

        var tx = new BankTransaction
        {
            Id = Guid.NewGuid(), Provider = provider, ProviderTxnId = txnId, Amount = amount,
            Content = content is { Length: > 500 } ? content[..500] : content,
            Gateway = gateway, AccountNumber = account, ReferenceCode = reference, TransactionDate = date, CreatedAt = DateTime.UtcNow,
        };

        // Spin codes bought by transfer (content MXS…) are settled by their own service.
        var spinOrderCode = SpinCodeShopService.FindOrderCode(content);
        if (spinOrderCode != null)
            return await _scopes.CreateScope().ServiceProvider.GetRequiredService<SpinCodeShopService>()
                .HandleTransferAsync(tx, spinOrderCode);

        var code = FindOrderCode(content);
        var order = code == null ? null : await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.OrderCode == code);
        string? alert = null;
        var settle = false;

        if (order == null)
        {
            tx.Status = "Unmatched";
            alert = $"💸 <b>Tiền về không khớp đơn nào</b>\n{Vnd(amount)} · {TelegramBot.Html(gateway)}\nNội dung: <code>{TelegramBot.Html(content)}</code>\n" +
                    "Gán tay trong admin → Thanh toán → Giao dịch.";
        }
        else
        {
            tx.OrderId = order.Id;
            tx.OrderCode = order.OrderCode;
            var alreadyPaidSum = await _db.BankTransactions.Where(t => t.OrderId == order.Id && (t.Status == "Underpaid" || t.Status == "Matched")).SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var paid = alreadyPaidSum + amount;
            if (order.Status is not (OrderStatus.Pending or OrderStatus.AwaitingConfirmation))
            {
                tx.Status = "AlreadyPaid";
                tx.Note = $"Đơn đang ở trạng thái {order.Status}";
            }
            else if (paid + 0.5m < order.TotalAmount)
            {
                tx.Status = "Underpaid";
                tx.Note = $"Đã nhận {Vnd(paid)} / {Vnd(order.TotalAmount)}";
            }
            else
            {
                tx.Status = "Matched";
                settle = true;
            }
        }

        _db.BankTransactions.Add(tx);
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            return false; // concurrent duplicate webhook delivery
        }

        if (settle)
        {
            var r = await _statuses.ChangeAsync(order!.Id, OrderStatus.Verifying, null);
            if (!r.Ok) _logger.LogWarning("Auto-confirm of {Order} failed: {Error}", order.OrderCode, r.Error);
            else _logger.LogInformation("Order {Order} auto-confirmed by bank transfer {Txn}", order.OrderCode, txnId);
            TelegramOrderNotifier.NotifyInBackground(_scopes, order.Id, $"💸 Đã nhận {Vnd(amount)} — tự xác nhận thanh toán", log: _logger);
        }
        else if (order != null)
        {
            var headline = tx.Status == "Underpaid"
                ? $"⚠️ Khách chuyển THIẾU: {tx.Note}"
                : $"⚠️ Nhận thêm {Vnd(amount)} cho đơn đã xử lý ({order.Status}) — kiểm tra hoàn tiền";
            TelegramOrderNotifier.NotifyInBackground(_scopes, order.Id, headline, log: _logger);
        }
        else if (alert != null)
        {
            TelegramOrderNotifier.TextInBackground(_scopes, alert, _logger);
        }
        return true;
    }

    /// <summary>Admin assigns an unmatched/underpaid transfer to an order (and confirms payment when covered).</summary>
    public async Task<(bool Ok, string? Error)> AssignAsync(Guid txId, string orderCode, string? admin)
    {
        var tx = await _db.BankTransactions.FirstOrDefaultAsync(t => t.Id == txId);
        if (tx == null) return (false, "Không tìm thấy giao dịch");
        var code = orderCode.Trim().ToUpperInvariant();
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.OrderCode == code);
        if (order == null) return (false, "Không tìm thấy đơn hàng");

        tx.OrderId = order.Id;
        tx.OrderCode = order.OrderCode;
        tx.Status = "Manual";
        tx.Note = $"Gán tay bởi {admin ?? "admin"}";
        await _db.SaveChangesAsync();

        if (order.Status is OrderStatus.Pending or OrderStatus.AwaitingConfirmation)
        {
            var paid = await _db.BankTransactions.Where(t => t.OrderId == order.Id && (t.Status == "Underpaid" || t.Status == "Matched" || t.Status == "Manual"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            if (paid + 0.5m >= order.TotalAmount)
            {
                var r = await _statuses.ChangeAsync(order.Id, OrderStatus.Verifying, null);
                if (!r.Ok) return (false, r.Error);
            }
        }
        return (true, null);
    }
}
