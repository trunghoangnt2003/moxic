using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>"Điểm thưởng": the logged-in customer's balance and points ledger (no RefId / CreatedBy).</summary>
[Route("api/account/points")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class AccountPointsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly PointsService _points;

    public AccountPointsController(MoxicDbContext db, PointsService points)
    {
        _db = db;
        _points = points;
    }

    // GET /api/account/points?page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetPoints([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Forbid(CustomerAuthRules.Scheme);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.PointsTransactions.AsNoTracking().Where(t => t.UserId == userId);
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new CustomerPointsTxDto(t.Id, t.Delta, t.Reason, t.Note, t.BalanceAfter, t.CreatedAt))
            .ToListAsync();

        var balance = await _points.GetBalanceAsync(userId);
        return Ok(new CustomerPointsResponse(balance, items, total, page, pageSize));
    }
}
