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
                CreatedAt = p != null ? (DateTime?)p.CreatedAt : null,
                u.LockoutEnd
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

        var now = DateTimeOffset.UtcNow;
        var items = rows
            .Select(x => new AdminCustomerDto(x.UserId, x.Email, x.DisplayName, x.EmailConfirmed, x.Points, x.CreatedAt,
                IsAdminLocked(x.LockoutEnd, now)))
            .ToList();
        return Ok(new { items, totalCount = total, page, pageSize });
    }

    // GET /api/admin/customers/{userId} — profile + activity summary
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetCustomer(string userId)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();

        var profile = await _db.CustomerProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id);
        var email = (user.Email ?? string.Empty).ToLower();
        var orders = _db.Orders.AsNoTracking().Where(o => o.CustomerId == user.Id || o.CustomerXboxEmail.ToLower() == email);

        return Ok(new
        {
            userId = user.Id,
            email = user.Email,
            displayName = profile?.DisplayName ?? string.Empty,
            emailVerified = user.EmailConfirmed,
            points = profile?.Points ?? 0,
            createdAt = profile?.CreatedAt,
            isLocked = IsAdminLocked(user.LockoutEnd, DateTimeOffset.UtcNow),
            failedLogins = user.AccessFailedCount,
            orderCount = await orders.CountAsync(),
            completedOrderCount = await orders.CountAsync(o => o.Status == Moxic.Shared.Enums.OrderStatus.Completed),
            totalSpent = await orders.Where(o => o.Status == Moxic.Shared.Enums.OrderStatus.Completed)
                .SumAsync(o => (decimal?)o.TotalAmount) ?? 0,
            spinCount = await _db.SpinHistories.AsNoTracking().CountAsync(h => h.UserId == user.Id),
            couponCount = await _db.Coupons.AsNoTracking().CountAsync(c => c.OwnerUserId == user.Id),
        });
    }

    // POST /api/admin/customers  { email, displayName, password, emailVerified }
    [HttpPost]
    public async Task<IActionResult> CreateCustomer([FromBody] AdminCustomerUpsertRequest request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request.Email);
        if (email == null) return BadRequest(new { error = "Email không hợp lệ." });
        var displayName = (request.DisplayName ?? string.Empty).Trim();
        if (displayName.Length < 2 || displayName.Length > 50)
            return BadRequest(new { error = "Tên hiển thị phải từ 2–50 ký tự." });
        if (string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Vui lòng nhập mật khẩu." });
        if (await _userManager.FindByEmailAsync(email) != null)
            return Conflict(new { error = "Email này đã được dùng cho một tài khoản khác." });

        await using var tx = await _db.Database.BeginTransactionAsync();
        var user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = request.EmailVerified ?? true };
        var created = await _userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(created.Errors) });
        await _userManager.AddToRoleAsync(user, CustomerAuthRules.CustomerRole);

        var now = DateTime.UtcNow;
        _db.CustomerProfiles.Add(new Moxic.Core.Entities.CustomerProfile
        {
            UserId = user.Id, DisplayName = displayName, Points = 0, CreatedAt = now, UpdatedAt = now
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { userId = user.Id });
    }

    // PUT /api/admin/customers/{userId}  { email?, displayName?, emailVerified? }
    [HttpPut("{userId}")]
    public async Task<IActionResult> UpdateCustomer(string userId, [FromBody] AdminCustomerUpsertRequest request)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();

        await using var tx = await _db.Database.BeginTransactionAsync();

        if (request.Email != null)
        {
            var email = CustomerAuthRules.NormalizeEmail(request.Email);
            if (email == null) return BadRequest(new { error = "Email không hợp lệ." });
            if (!string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                var other = await _userManager.FindByEmailAsync(email);
                if (other != null && other.Id != user.Id)
                    return Conflict(new { error = "Email này đã được dùng cho một tài khoản khác." });
                user.Email = email;
                user.UserName = email;
                user.NormalizedEmail = _userManager.NormalizeEmail(email);
                user.NormalizedUserName = _userManager.NormalizeName(email);
            }
        }

        if (request.EmailVerified.HasValue) user.EmailConfirmed = request.EmailVerified.Value;

        var updated = await _userManager.UpdateAsync(user);
        if (!updated.Succeeded)
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(updated.Errors) });

        if (request.DisplayName != null)
        {
            var displayName = request.DisplayName.Trim();
            if (displayName.Length < 2 || displayName.Length > 50)
                return BadRequest(new { error = "Tên hiển thị phải từ 2–50 ký tự." });
            await EnsureProfileAsync(user.Id, displayName);
        }

        await tx.CommitAsync();
        return NoContent();
    }

    // POST /api/admin/customers/{userId}/verify — mark email verified on the customer's behalf
    [HttpPost("{userId}/verify")]
    public async Task<IActionResult> VerifyCustomer(string userId)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();

        user.EmailConfirmed = true;
        await _userManager.UpdateAsync(user);
        // Pending codes are no longer needed.
        await _db.CustomerOtpCodes.Where(c => c.UserId == user.Id && c.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.ConsumedAt, DateTime.UtcNow));
        return NoContent();
    }

    // POST /api/admin/customers/{userId}/password  { password } — set a new password, ends other sessions
    [HttpPost("{userId}/password")]
    public async Task<IActionResult> SetPassword(string userId, [FromBody] AdminSetPasswordRequest request)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();
        if (string.IsNullOrEmpty(request.Password)) return BadRequest(new { error = "Vui lòng nhập mật khẩu mới." });

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(result.Errors) });

        await _userManager.ResetAccessFailedCountAsync(user);
        if (!IsAdminLocked(user.LockoutEnd, DateTimeOffset.UtcNow))
            await _userManager.SetLockoutEndDateAsync(user, null);
        return NoContent();
    }

    // POST /api/admin/customers/{userId}/lock  { locked }
    [HttpPost("{userId}/lock")]
    public async Task<IActionResult> SetLocked(string userId, [FromBody] AdminLockRequest request)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();

        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, request.Locked ? DateTimeOffset.MaxValue : null);
        if (!request.Locked) await _userManager.ResetAccessFailedCountAsync(user);
        // Changing the stamp signs the customer out everywhere.
        await _userManager.UpdateSecurityStampAsync(user);
        return NoContent();
    }

    // DELETE /api/admin/customers/{userId}
    // Orders/spin history are kept (unlinked); profile, points ledger, cooldowns and codes cascade.
    [HttpDelete("{userId}")]
    public async Task<IActionResult> DeleteCustomer(string userId)
    {
        var user = await FindCustomerAsync(userId);
        if (user == null) return CustomerNotFound();

        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.Orders.Where(o => o.CustomerId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.CustomerId, (string?)null));
        await _db.SpinHistories.Where(h => h.UserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.UserId, (string?)null));
        // Wallet coupons die with the account (redeemed ones stay for order history).
        await _db.Coupons.Where(c => c.OwnerUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, false));

        var deleted = await _userManager.DeleteAsync(user);
        if (!deleted.Succeeded)
        {
            await tx.RollbackAsync();
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(deleted.Errors) });
        }
        await tx.CommitAsync();
        return NoContent();
    }

    /// <summary>Admin lock = lockout end far in the future (temporary failed-login lockouts are minutes).</summary>
    private static bool IsAdminLocked(DateTimeOffset? lockoutEnd, DateTimeOffset now) =>
        lockoutEnd.HasValue && lockoutEnd.Value > now.AddYears(1);

    private async Task<IdentityUser?> FindCustomerAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 450) return null;
        var user = await _userManager.FindByIdAsync(userId);
        return user != null && await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole) ? user : null;
    }

    private async Task EnsureProfileAsync(string userId, string displayName)
    {
        var now = DateTime.UtcNow;
        var profile = await _db.CustomerProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
        {
            _db.CustomerProfiles.Add(new Moxic.Core.Entities.CustomerProfile
            {
                UserId = userId, DisplayName = displayName, Points = 0, CreatedAt = now, UpdatedAt = now
            });
        }
        else
        {
            profile.DisplayName = displayName;
            profile.UpdatedAt = now;
        }
        await _db.SaveChangesAsync();
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
