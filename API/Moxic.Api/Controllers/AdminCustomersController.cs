using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>"Khách hàng": storefront customers with points balances, ledgers and manual adjustments.</summary>
[Route("api/admin/customers")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminCustomersController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly PointsService _points;

    public AdminCustomersController(MoxicDbContext db, UserManager<IdentityUser> userManager, PointsService points)
    {
        _db = db;
        _userManager = userManager;
        _points = points;
    }

    // GET /api/admin/customers?search=&sort=newest|points&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetCustomers(
        [FromQuery] string? search, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var roleId = await CustomerRoleIdAsync();
        if (roleId == null)
            return Ok(new { items = Array.Empty<AdminCustomerDto>(), totalCount = 0, page, pageSize });

        var query =
            from u in _db.Users.AsNoTracking()
            join ur in _db.UserRoles.AsNoTracking() on u.Id equals ur.UserId
            where ur.RoleId == roleId
            join p in _db.CustomerProfiles.AsNoTracking() on u.Id equals p.UserId into profiles
            from p in profiles.DefaultIfEmpty()
            select new
            {
                UserId = u.Id,
                Email = u.Email ?? u.UserName ?? string.Empty,
                u.EmailConfirmed,
                DisplayName = p != null ? p.DisplayName : string.Empty,
                Points = p != null ? p.Points : 0,
                CreatedAt = p != null ? (DateTime?)p.CreatedAt : null
            };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            if (s.Length > 100) s = s[..100];
            query = query.Where(x => x.Email.ToLower().Contains(s) || x.DisplayName.ToLower().Contains(s));
        }

        var total = await query.CountAsync();
        var ordered = string.Equals(sort, "points", StringComparison.OrdinalIgnoreCase)
            ? query.OrderByDescending(x => x.Points).ThenBy(x => x.Email)
            : query.OrderBy(x => x.CreatedAt == null).ThenByDescending(x => x.CreatedAt).ThenBy(x => x.Email);

        var rows = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = rows
            .Select(x => new AdminCustomerDto(x.UserId, x.Email, x.DisplayName, x.EmailConfirmed, x.Points, x.CreatedAt))
            .ToList();
        return Ok(new { items, totalCount = total, page, pageSize });
    }

    // GET /api/admin/customers/{userId}/points?page=1&pageSize=20
    [HttpGet("{userId}/points")]
    public async Task<IActionResult> GetPoints(string userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!await IsCustomerAsync(userId)) return CustomerNotFound();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.PointsTransactions.AsNoTracking().Where(t => t.UserId == userId);
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new AdminPointsTxDto(t.Id, t.Delta, t.Reason, t.RefId, t.Note, t.BalanceAfter, t.CreatedBy, t.CreatedAt))
            .ToListAsync();

        var balance = await _points.GetBalanceAsync(userId);
        return Ok(new { balance, items, totalCount = total, page, pageSize });
    }

    // POST /api/admin/customers/{userId}/points  { delta, note }
    [HttpPost("{userId}/points")]
    public async Task<IActionResult> AdjustPoints(string userId, [FromBody] AdjustPointsRequest request)
    {
        if (!await IsCustomerAsync(userId)) return CustomerNotFound();

        if (request.Delta == 0 || Math.Abs((long)request.Delta) > 1_000_000)
            return BadRequest(new { error = "Số điểm điều chỉnh phải khác 0 và không vượt quá 1.000.000." });

        var note = (request.Note ?? string.Empty).Trim();
        if (note.Length < 2 || note.Length > 200)
            return BadRequest(new { error = "Vui lòng nhập lý do điều chỉnh (2–200 ký tự)." });

        await using var tx = await _db.Database.BeginTransactionAsync();
        var (ok, balance, entry) = await _points.AdjustAsync(userId, request.Delta, note, User.Identity?.Name);
        if (!ok || entry == null)
        {
            await tx.RollbackAsync();
            return Conflict(new { error = $"Số dư không đủ để trừ (hiện có {balance} điểm)." });
        }
        await tx.CommitAsync();

        return Ok(new
        {
            balance,
            transaction = new AdminPointsTxDto(entry.Id, entry.Delta, entry.Reason, entry.RefId, entry.Note,
                entry.BalanceAfter, entry.CreatedBy, entry.CreatedAt)
        });
    }

    private async Task<string?> CustomerRoleIdAsync() =>
        await _db.Roles.AsNoTracking()
            .Where(r => r.Name == CustomerAuthRules.CustomerRole)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

    private async Task<bool> IsCustomerAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 450) return false;
        var user = await _userManager.FindByIdAsync(userId);
        return user != null && await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole);
    }

    private NotFoundObjectResult CustomerNotFound() => NotFound(new { error = "Không tìm thấy khách hàng." });
}
