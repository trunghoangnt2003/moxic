using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Customers buy spins for a code case by bank transfer. Each purchase is a <see cref="SpinCodeOrder"/>
/// whose transfer content is its code (MXS + 8 characters); when SePay reports the money, a spin code with
/// the bought number of uses is issued and the customer is notified.
/// </summary>
public class SpinCodeShopService
{
    public const int MaxQuantity = 20;
    private const int MaxPendingPerUser = 3;
    private static readonly Regex CodeInContent = new(@"MXS([A-Z0-9]{8})", RegexOptions.Compiled);
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    private readonly MoxicDbContext _db;
    private readonly NotificationService _notifications;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<SpinCodeShopService> _logger;

    public SpinCodeShopService(MoxicDbContext db, NotificationService notifications, IServiceScopeFactory scopes, ILogger<SpinCodeShopService> logger)
    {
        _db = db;
        _notifications = notifications;
        _scopes = scopes;
        _logger = logger;
    }

    /// <summary>The spin-code order code in a bank transfer's content, e.g. "MXS7K2P9QRT".</summary>
    public static string? FindOrderCode(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var normalized = Regex.Replace(content.ToUpperInvariant(), "[^A-Z0-9]", "");
        var m = CodeInContent.Match(normalized);
        return m.Success ? $"MXS{m.Groups[1].Value}" : null;
    }

    private static string Vnd(decimal v) => v.ToString("N0", Vi) + "đ";

    public async Task<(SpinCodeOrder? Order, string? Error)> CreateAsync(string userId, SpinCase spinCase, int quantity)
    {
        if (spinCase.OpenMethod != SpinCaseOpenMethod.Code || spinCase.CodePrice <= 0)
            return (null, "Hòm này chưa mở bán mã quay.");
        if (quantity < 1 || quantity > MaxQuantity)
            return (null, RequestLanguage.T($"Số lượt mua từ 1 đến {MaxQuantity}.", $"You can buy 1 to {MaxQuantity} spins."));

        var since = DateTime.UtcNow.AddHours(-24);
        var pending = await _db.SpinCodeOrders.CountAsync(o => o.UserId == userId && o.Status == "Pending" && o.CreatedAt > since);
        if (pending >= MaxPendingPerUser)
            return (null, "Bạn đang có nhiều đơn mua mã chưa thanh toán. Hãy thanh toán hoặc chờ đơn cũ hết hạn.");

        string code;
        do code = "MXS" + LuckySpinRules.GenerateCode(8);
        while (await _db.SpinCodeOrders.AnyAsync(o => o.Code == code));

        var order = new SpinCodeOrder
        {
            Id = Guid.NewGuid(),
            Code = code,
            UserId = userId,
            CaseId = spinCase.Id,
            Quantity = quantity,
            UnitPrice = spinCase.CodePrice,
            Amount = spinCase.CodePrice * quantity,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow,
        };
        _db.SpinCodeOrders.Add(order);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Spin code order {Code}: {Qty} x {Case} = {Amount}", code, quantity, spinCase.Slug, order.Amount);
        return (order, null);
    }

    /// <summary>
    /// Records a transfer whose content names a spin-code order and issues the code once the order is fully paid.
    /// Returns false when this transaction was already processed (duplicate webhook).
    /// </summary>
    public async Task<bool> HandleTransferAsync(BankTransaction tx, string orderCode)
    {
        if (await _db.BankTransactions.AnyAsync(t => t.Provider == tx.Provider && t.ProviderTxnId == tx.ProviderTxnId)) return false;

        var order = await _db.SpinCodeOrders.Include(o => o.Case).FirstOrDefaultAsync(o => o.Code == orderCode);
        tx.OrderCode = orderCode;
        SpinCode? issued = null;
        string telegram;

        if (order == null)
        {
            tx.Status = "Unmatched";
            telegram = $"💸 <b>Tiền về với mã mua lượt quay không tồn tại</b>\n{Vnd(tx.Amount)}\nNội dung: <code>{TelegramBot.Html(tx.Content)}</code>";
        }
        else if (order.Status == "Paid")
        {
            tx.Status = "AlreadyPaid";
            tx.Note = "Đơn mua lượt quay đã thanh toán trước đó";
            telegram = $"⚠️ Nhận thêm {Vnd(tx.Amount)} cho đơn mua lượt quay <code>{order.Code}</code> đã thanh toán — kiểm tra hoàn tiền";
        }
        else
        {
            var before = await _db.BankTransactions.Where(t => t.OrderCode == order.Code && t.Status == "Underpaid").SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var paid = before + tx.Amount;
            if (paid + 0.5m < order.Amount)
            {
                tx.Status = "Underpaid";
                tx.Note = $"Đã nhận {Vnd(paid)} / {Vnd(order.Amount)}";
                telegram = $"⚠️ Khách chuyển THIẾU cho đơn mua lượt quay <code>{order.Code}</code>: {tx.Note}";
            }
            else
            {
                string spinCode;
                do spinCode = LuckySpinRules.GenerateCode(LuckySpinRules.SpinCodeLength);
                while (await _db.SpinCodes.AnyAsync(c => c.Code == spinCode));

                issued = new SpinCode
                {
                    Id = Guid.NewGuid(),
                    CaseId = order.CaseId,
                    Code = spinCode,
                    MaxUses = order.Quantity,
                    UsedCount = 0,
                    IsActive = true,
                    Note = $"Khách mua qua chuyển khoản {order.Code}",
                    CreatedAt = DateTime.UtcNow,
                };
                _db.SpinCodes.Add(issued);
                order.Status = "Paid";
                order.PaidAt = DateTime.UtcNow;
                order.SpinCodeId = issued.Id;
                tx.Status = "Matched";
                var email = await _db.Users.AsNoTracking().Where(u => u.Id == order.UserId).Select(u => u.Email).FirstOrDefaultAsync();
                telegram = $"🎰 <b>Bán mã quay — đã thanh toán</b>\n" +
                           $"Hòm: {TelegramBot.Html(order.Case?.Name)}\n" +
                           $"Số lượt: {order.Quantity} × {Vnd(order.UnitPrice)} = <b>{Vnd(order.Amount)}</b> (nhận {Vnd(tx.Amount)})\n" +
                           $"Khách: {TelegramBot.Html(email ?? order.UserId)}\n" +
                           $"Đơn <code>{order.Code}</code> · mã đã cấp tự động <code>{spinCode}</code>";
            }
        }

        _db.BankTransactions.Add(tx);
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            return false; // concurrent duplicate webhook delivery
        }

        if (issued != null && order != null)
        {
            _logger.LogInformation("Spin code order {Order} paid, issued {Code} ({Uses} uses)", order.Code, issued.Code, issued.MaxUses);
            try
            {
                var en = await _notifications.IsEnglishAsync(order.UserId);
                var caseName = en && !string.IsNullOrWhiteSpace(order.Case?.NameEn) ? order.Case!.NameEn : order.Case?.Name;
                await _notifications.AddAsync(order.UserId, "spin",
                    en ? $"🎰 Your spin code is ready: {issued.Code}" : $"🎰 Mã quay của bạn đã sẵn sàng: {issued.Code}",
                    en ? $"{order.Quantity} spins for {caseName}. Open the case now!" : $"{order.Quantity} lượt mở {caseName}. Mở hòm ngay!",
                    $"/lucky-spin/{order.Case?.Slug}?code={issued.Code}");
            }
            catch (Exception e)
            {
                _logger.LogWarning(e, "Spin code notification failed for {Order}", order.Code);
            }
        }
        TelegramOrderNotifier.TextInBackground(_scopes, telegram, _logger);
        return true;
    }
}
