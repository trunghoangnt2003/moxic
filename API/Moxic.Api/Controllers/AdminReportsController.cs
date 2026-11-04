using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>"Tổng quan": revenue dashboard. Revenue = orders whose payment has been confirmed.</summary>
[Route("api/admin/reports")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminReportsController : ControllerBase
{
    private static readonly OrderStatus[] PaidStatuses =
        { OrderStatus.Verifying, OrderStatus.Installing, OrderStatus.ActionRequired, OrderStatus.Completed };

    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    private readonly MoxicDbContext _db;

    public AdminReportsController(MoxicDbContext db) => _db = db;

    // GET /api/admin/reports/overview?days=30
    [HttpGet("overview")]
    public async Task<IActionResult> Overview([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 366);
        // Day boundaries in Vietnam time.
        var todayVn = (DateTime.UtcNow + VnOffset).Date;
        var fromVn = todayVn.AddDays(-(days - 1));
        var from = DateTime.SpecifyKind(fromVn - VnOffset, DateTimeKind.Utc);
        var prevFrom = from.AddDays(-days);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= prevFrom)
            .Select(o => new { o.Id, o.CreatedAt, o.TotalAmount, o.DiscountAmount, o.Status, o.PaymentMethod })
            .ToListAsync();

        var current = orders.Where(o => o.CreatedAt >= from).ToList();
        var previous = orders.Where(o => o.CreatedAt < from).ToList();
        var paidNow = current.Where(o => PaidStatuses.Contains(o.Status)).ToList();
        var paidPrev = previous.Where(o => PaidStatuses.Contains(o.Status)).ToList();

        decimal Revenue<T>(IEnumerable<T> list, Func<T, decimal> sel) => list.Sum(sel);
        var revenue = Revenue(paidNow, o => o.TotalAmount);
        var revenuePrev = Revenue(paidPrev, o => o.TotalAmount);

        var newCustomers = await _db.CustomerProfiles.AsNoTracking().CountAsync(p => p.CreatedAt >= from);
        var newCustomersPrev = await _db.CustomerProfiles.AsNoTracking().CountAsync(p => p.CreatedAt >= prevFrom && p.CreatedAt < from);

        // Daily series (Vietnam dates), zero-filled.
        var byDay = paidNow
            .GroupBy(o => (o.CreatedAt + VnOffset).Date)
            .ToDictionary(g => g.Key, g => new { Revenue = g.Sum(x => x.TotalAmount), Orders = g.Count() });
        var series = Enumerable.Range(0, days).Select(i =>
        {
            var d = fromVn.AddDays(i);
            var hit = byDay.GetValueOrDefault(d);
            return new { date = d.ToString("yyyy-MM-dd"), revenue = hit?.Revenue ?? 0m, orders = hit?.Orders ?? 0 };
        }).ToList();

        var statusBreakdown = current
            .GroupBy(o => o.Status)
            .Select(g => new { status = g.Key.ToString(), count = g.Count(), amount = g.Sum(x => x.TotalAmount) })
            .OrderByDescending(x => x.count)
            .ToList();

        var paymentSplit = paidNow
            .GroupBy(o => o.PaymentMethod)
            .Select(g => new { method = g.Key.ToString(), count = g.Count(), revenue = g.Sum(x => x.TotalAmount) })
            .ToList();

        var paidIds = paidNow.Select(o => o.Id).ToList();
        var lines = await _db.OrderDetails.AsNoTracking()
            .Where(d => paidIds.Contains(d.OrderId))
            .Select(d => new { d.GameId, d.Price, Name = d.Game.Name, Type = d.Game.ProductType })
            .ToListAsync();

        var topGames = lines
            .GroupBy(l => new { l.GameId, l.Name })
            .Select(g => new { gameId = g.Key.GameId, name = g.Key.Name, quantity = g.Count(), revenue = g.Sum(x => x.Price) })
            .OrderByDescending(x => x.revenue).ThenByDescending(x => x.quantity)
            .Take(8)
            .ToList();

        var byProductType = lines
            .GroupBy(l => l.Type)
            .Select(g => new { type = g.Key, quantity = g.Count(), revenue = g.Sum(x => x.Price) })
            .OrderByDescending(x => x.revenue)
            .ToList();

        // Work queue (all time, not range-bound): what needs admin action now.
        var queue = await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.AwaitingConfirmation || o.Status == OrderStatus.Verifying
                        || o.Status == OrderStatus.Installing || o.Status == OrderStatus.ActionRequired)
            .GroupBy(o => o.Status)
            .Select(g => new { status = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var spins = await _db.SpinHistories.AsNoTracking().CountAsync(h => h.CreatedAt >= from);
        var rentalQueue = new
        {
            awaiting = await _db.RentalOrders.AsNoTracking().CountAsync(r => r.Status == Moxic.Core.Entities.RentalStatus.AwaitingConfirmation),
            expired = await _db.RentalOrders.AsNoTracking().CountAsync(r => r.Status == Moxic.Core.Entities.RentalStatus.Expired),
            active = await _db.RentalOrders.AsNoTracking().CountAsync(r => r.Status == Moxic.Core.Entities.RentalStatus.Active),
        };
        var rentalRevenue = await _db.RentalOrders.AsNoTracking()
            .Where(r => r.PaidAt != null && r.PaidAt >= from)
            .SumAsync(r => (decimal?)r.Price) ?? 0m;

        return Ok(new
        {
            days,
            from = fromVn.ToString("yyyy-MM-dd"),
            to = todayVn.ToString("yyyy-MM-dd"),
            kpis = new
            {
                revenue,
                revenuePrev,
                paidOrders = paidNow.Count,
                paidOrdersPrev = paidPrev.Count,
                averageOrderValue = paidNow.Count > 0 ? Math.Round(revenue / paidNow.Count) : 0,
                averageOrderValuePrev = paidPrev.Count > 0 ? Math.Round(revenuePrev / paidPrev.Count) : 0,
                newCustomers,
                newCustomersPrev,
                discountGiven = Revenue(paidNow, o => o.DiscountAmount),
                totalOrders = current.Count,
                cancelledOrders = current.Count(o => o.Status == OrderStatus.Cancelled),
                conversionRate = current.Count > 0 ? Math.Round(100.0 * paidNow.Count / current.Count, 1) : 0,
                spins,
            },
            series,
            statusBreakdown,
            paymentSplit,
            topGames,
            byProductType,
            queue,
            rentalQueue,
            rentalRevenue,
        });
    }
}
