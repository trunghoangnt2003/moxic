using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>Admin: share rooms, the manual refund queue, and the Xbox account provided for "Moxic" rooms.</summary>
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminShareRoomsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly ShareRoomService _shares;

    public AdminShareRoomsController(MoxicDbContext db, ShareRoomService shares)
    {
        _db = db;
        _shares = shares;
    }

    // GET /api/admin/share?status=Open|Full|Funded|Cancelled&needsRefund=true&q=
    [HttpGet("api/admin/share")]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] bool needsRefund = false, [FromQuery] string? q = null)
    {
        var query = _db.ShareRooms.AsNoTracking().Include(r => r.Seats).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status);
        if (needsRefund) query = query.Where(r => r.Seats.Any(s => s.NeedsRefund && s.RefundedAt == null));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToUpperInvariant();
            query = query.Where(r => r.Code == term || r.GameName.ToUpper().Contains(term) || r.Seats.Any(s => s.PaymentCode == term));
        }
        var rooms = await query.OrderByDescending(r => r.UpdatedAt).Take(200).ToListAsync();
        var orderIds = rooms.Where(r => r.OrderId != null).Select(r => r.OrderId!.Value).ToList();
        var orders = await _db.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, o => new { o.OrderCode, Status = o.Status.ToString() });
        return Ok(rooms.Select(r => new
        {
            r.Code, r.GameName, r.TotalPrice, r.AccountType, r.OwnerPercent, r.IsPublic, r.Status, r.Locked, r.CreatedAt, r.UpdatedAt,
            r.FullAt, r.FundedAt, r.ClosedAt, r.CancelReason,
            Order = r.OrderId != null && orders.TryGetValue(r.OrderId.Value, out var o) ? o : null,
            Seats = r.Seats.OrderBy(s => s.JoinedAt).Select(s => new
            {
                s.Id, s.DisplayName, s.UserId, s.IsOwner, s.Percent, s.ShareAmount, s.DiscountAmount, s.CouponCode, s.AmountDue,
                s.PaymentCode, s.PaidAmount, s.PaidAt, s.JoinedAt, s.LeftAt, s.LeftReason, s.NeedsRefund, s.RefundedAt,
            }),
            NeedsRefund = r.Seats.Any(s => s.NeedsRefund && s.RefundedAt == null),
        }));
    }

    // GET /api/admin/share/{code} — room + seat emails + transfers + discussion
    [HttpGet("api/admin/share/{code}")]
    public async Task<IActionResult> Get(string code)
    {
        var room = await _shares.LoadAsync(code);
        if (room == null) return NotFound(new { error = "Không tìm thấy phòng" });
        var userIds = room.Seats.Select(s => s.UserId).Distinct().ToList();
        var emails = await _db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email);
        var codes = room.Seats.Where(s => s.PaymentCode != null).Select(s => s.PaymentCode!).ToList();
        var transfers = await _db.BankTransactions.AsNoTracking().Where(t => t.OrderCode != null && codes.Contains(t.OrderCode))
            .OrderBy(t => t.CreatedAt)
            .Select(t => new { t.Id, t.Amount, t.Content, t.Status, t.Note, t.OrderCode, t.CreatedAt }).ToListAsync();
        var names = room.Seats.GroupBy(s => s.UserId).ToDictionary(g => g.Key, g => g.First().DisplayName);
        var messages = await _db.ShareMessages.AsNoTracking().Where(m => m.RoomId == room.Id).OrderBy(m => m.CreatedAt)
            .Select(m => new { m.Id, m.UserId, m.Text, m.Reported, m.CreatedAt }).ToListAsync();
        var order = room.OrderId == null ? null : await _db.Orders.AsNoTracking().Where(o => o.Id == room.OrderId)
            .Select(o => new { o.Id, o.OrderCode, Status = o.Status.ToString(), HasProvidedAccount = o.ProvidedAccountEmail != null, o.ProvidedAccountEmail })
            .FirstOrDefaultAsync();
        return Ok(new
        {
            room.Code, room.GameName, room.TotalPrice, room.AccountType, room.OwnerPercent, room.IsPublic, room.Status, room.Locked,
            room.CreatedAt, room.FullAt, room.FundedAt, room.ClosedAt, room.CancelReason, Order = order,
            Seats = room.Seats.OrderBy(s => s.JoinedAt).Select(s => new
            {
                s.Id, s.DisplayName, s.UserId, Email = emails.GetValueOrDefault(s.UserId), s.IsOwner, s.Percent, s.ShareAmount, s.DiscountAmount,
                s.CouponCode, s.AmountDue, s.PaymentCode, s.PaidAmount, s.PaidAt, s.XboxEmail, s.JoinedAt, s.LeftAt, s.LeftReason,
                s.NeedsRefund, s.RefundedAt,
            }),
            Transfers = transfers,
            Messages = messages.Select(m => new { m.Id, Author = m.UserId == null ? null : names.GetValueOrDefault(m.UserId), m.Text, m.Reported, m.CreatedAt }),
        });
    }

    // POST /api/admin/share/{code}/close — closes an Open/Full room; paid seats go to the refund queue
    [HttpPost("api/admin/share/{code}/close")]
    public async Task<IActionResult> Close(string code, [FromBody] ShareCloseBody body)
    {
        var room = await _shares.LoadAsync(code);
        if (room == null) return NotFound(new { error = "Không tìm thấy phòng" });
        if (room.Status is not ("Open" or "Full")) return BadRequest(new { error = "Chỉ đóng được phòng đang chờ người hoặc chờ thanh toán" });
        await _shares.CloseAsync(room, string.IsNullOrWhiteSpace(body.Reason) ? "admin" : body.Reason.Trim()[..Math.Min(body.Reason.Trim().Length, 300)]);
        return Ok(new { ok = true });
    }

    // POST /api/admin/share/seats/{id}/refunded
    [HttpPost("api/admin/share/seats/{id:guid}/refunded")]
    public async Task<IActionResult> Refunded(Guid id)
    {
        var error = await _shares.MarkRefundedAsync(id);
        return error == null ? Ok(new { ok = true }) : BadRequest(new { error });
    }

    // PUT /api/admin/orders/{id}/provided-account — Xbox account Moxic provided for a "Moxic" share room
    [HttpPut("api/admin/orders/{id:guid}/provided-account")]
    public async Task<IActionResult> ProvidedAccount(Guid id, [FromBody] ProvidedAccountBody body)
    {
        var error = await _shares.SetProvidedAccountAsync(id, body.Email, body.Password);
        return error == null ? Ok(new { ok = true }) : BadRequest(new { error });
    }
}
