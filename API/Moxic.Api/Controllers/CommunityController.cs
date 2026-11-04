using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record CommentRequest(string? Content, Guid? ParentId);
public record ReportRequest(string? TargetType, Guid TargetId, string? Reason, string? Note);

/// <summary>Game discussion (comments + one reply level), "my review" and content reports.</summary>
[ApiController]
public class CommunityController : ControllerBase
{
    public static readonly string[] Reasons = { "Spam", "Offensive", "Scam", "Spoiler", "Other" };

    private readonly MoxicDbContext _db;
    private readonly CommunityService _community;

    public CommunityController(MoxicDbContext db, CommunityService community)
    {
        _db = db;
        _community = community;
    }

    // GET /api/games/{id}/comments?page=1
    [HttpGet("api/games/{id:guid}/comments")]
    public async Task<IActionResult> Comments(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 30);
        var me = await _community.GetCustomerAsync(HttpContext);

        var top = _db.GameComments.AsNoTracking().Where(c => c.GameId == id && c.ParentId == null && !c.IsHidden);
        var total = await top.CountAsync();
        var roots = await top.OrderByDescending(c => c.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var rootIds = roots.Select(r => r.Id).ToList();
        var replies = await _db.GameComments.AsNoTracking()
            .Where(c => c.ParentId != null && rootIds.Contains(c.ParentId.Value) && !c.IsHidden)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        // Authors who bought the game get a badge.
        var authorIds = roots.Concat(replies).Select(c => c.UserId).Distinct().ToList();
        var buyers = await _db.OrderDetails.AsNoTracking()
            .Where(d => d.GameId == id && CommunityService.PaidStatuses.Contains(d.Order.Status) && d.Order.CustomerId != null && authorIds.Contains(d.Order.CustomerId))
            .Select(d => d.Order.CustomerId!)
            .Distinct()
            .ToListAsync();

        object Map(GameComment c) => new
        {
            c.Id, c.ParentId, c.DisplayName, c.Content, c.CreatedAt,
            isMine = me != null && c.UserId == me.UserId,
            isBuyer = buyers.Contains(c.UserId),
        };

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = roots.Select(r => new
            {
                comment = Map(r),
                replies = replies.Where(x => x.ParentId == r.Id).Select(Map).ToList(),
            }),
        });
    }

    // POST /api/games/{id}/comments { content, parentId? }
    [HttpPost("api/games/{id:guid}/comments")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> PostComment(Guid id, [FromBody] CommentRequest request)
    {
        var me = await _community.GetCustomerAsync(HttpContext);
        if (me == null) return Forbid(CustomerAuthRules.Scheme);
        var content = (request.Content ?? string.Empty).Trim();
        if (content.Length < 2 || content.Length > 1000) return BadRequest(new { error = "Bình luận phải từ 2–1000 ký tự." });
        if (!await _db.Games.AnyAsync(g => g.Id == id)) return NotFound(new { error = "Không tìm thấy game." });
        if (request.ParentId.HasValue && !await _db.GameComments.AnyAsync(c => c.Id == request.ParentId && c.GameId == id && c.ParentId == null && !c.IsHidden))
            return BadRequest(new { error = "Bình luận gốc không tồn tại." });

        // Simple flood guard: max 5 comments per user per 10 minutes.
        var since = DateTime.UtcNow.AddMinutes(-10);
        if (await _db.GameComments.CountAsync(c => c.UserId == me.UserId && c.CreatedAt > since) >= 5)
            return StatusCode(429, new { error = "Bạn bình luận hơi nhanh, thử lại sau ít phút nhé." });

        var comment = new GameComment
        {
            Id = Guid.NewGuid(), GameId = id, ParentId = request.ParentId, UserId = me.UserId,
            DisplayName = me.DisplayName.Length > 50 ? me.DisplayName[..50] : me.DisplayName,
            Content = content, CreatedAt = DateTime.UtcNow,
        };
        _db.GameComments.Add(comment);
        await _db.SaveChangesAsync();
        return Ok(new { comment.Id, comment.ParentId, comment.DisplayName, comment.Content, comment.CreatedAt, isMine = true, isBuyer = await _community.HasPurchasedAsync(me, id) });
    }

    // DELETE /api/comments/{id} — author deletes own comment
    [HttpDelete("api/comments/{id:guid}")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> DeleteComment(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var deleted = await _db.GameComments.Where(c => c.Id == id && c.UserId == userId).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound(new { error = "Không tìm thấy bình luận." }) : NoContent();
    }

    // GET /api/games/{id}/my-review — the signed-in customer's review + whether it would be verified
    [HttpGet("api/games/{id:guid}/my-review")]
    public async Task<IActionResult> MyReview(Guid id)
    {
        var me = await _community.GetCustomerAsync(HttpContext);
        if (me == null) return Ok(new { signedIn = false });
        var review = await _db.GameReviews.AsNoTracking().Where(r => r.GameId == id && r.UserId == me.UserId)
            .Select(r => new { r.Id, r.Rating, r.Content, r.IsHidden }).FirstOrDefaultAsync();
        return Ok(new { signedIn = true, displayName = me.DisplayName, purchased = await _community.HasPurchasedAsync(me, id), review });
    }

    // POST /api/reports { targetType, targetId, reason, note }
    [HttpPost("api/reports")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Report([FromBody] ReportRequest request)
    {
        var type = request.TargetType == "Review" ? "Review" : request.TargetType == "Comment" ? "Comment" : null;
        if (type == null) return BadRequest(new { error = "Loại nội dung không hợp lệ." });
        var reason = Reasons.FirstOrDefault(r => string.Equals(r, request.Reason, StringComparison.OrdinalIgnoreCase)) ?? "Other";
        var exists = type == "Review"
            ? await _db.GameReviews.AnyAsync(r => r.Id == request.TargetId)
            : await _db.GameComments.AnyAsync(c => c.Id == request.TargetId);
        if (!exists) return NotFound(new { error = "Nội dung không tồn tại." });

        var me = await _community.GetCustomerAsync(HttpContext);
        var ip = LuckySpinRules.GetClientIp(HttpContext);
        var dup = await _db.ContentReports.AnyAsync(r => r.TargetType == type && r.TargetId == request.TargetId && r.Status == "Open"
            && ((me != null && r.ReporterUserId == me.UserId) || (me == null && r.ReporterIp == ip)));
        if (!dup)
        {
            _db.ContentReports.Add(new ContentReport
            {
                Id = Guid.NewGuid(), TargetType = type, TargetId = request.TargetId, ReporterUserId = me?.UserId, ReporterIp = ip,
                Reason = reason, Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()[..Math.Min(request.Note.Trim().Length, 300)],
                Status = "Open", CreatedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
        }
        return Ok(new { message = "Cảm ơn bạn! Moxic sẽ xem xét nội dung này." });
    }
}

/// <summary>Admin moderation: reports queue + hide/unhide/dismiss + recent comments.</summary>
[Route("api/admin/moderation")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminModerationController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminModerationController(MoxicDbContext db) => _db = db;

    // GET /api/admin/moderation/reports?status=Open
    [HttpGet("reports")]
    public async Task<IActionResult> Reports([FromQuery] string status = "Open")
    {
        var reports = await _db.ContentReports.AsNoTracking().Where(r => r.Status == status)
            .OrderByDescending(r => r.CreatedAt).Take(500).ToListAsync();
        var reviewIds = reports.Where(r => r.TargetType == "Review").Select(r => r.TargetId).Distinct().ToList();
        var commentIds = reports.Where(r => r.TargetType == "Comment").Select(r => r.TargetId).Distinct().ToList();
        var reviews = await _db.GameReviews.AsNoTracking().Where(r => reviewIds.Contains(r.Id))
            .Select(r => new { r.Id, Author = r.UserName, r.Content, r.Rating, r.IsHidden, r.GameId, GameName = r.Game.Name, r.CreatedAt }).ToListAsync();
        var comments = await (from c in _db.GameComments.AsNoTracking()
                              join g in _db.Games.AsNoTracking() on c.GameId equals g.Id
                              where commentIds.Contains(c.Id)
                              select new { c.Id, Author = c.DisplayName, c.Content, Rating = 0, c.IsHidden, c.GameId, GameName = g.Name, c.CreatedAt }).ToListAsync();

        var items = reports.GroupBy(r => new { r.TargetType, r.TargetId }).Select(g =>
        {
            var target = g.Key.TargetType == "Review"
                ? (object?)reviews.FirstOrDefault(x => x.Id == g.Key.TargetId)
                : comments.FirstOrDefault(x => x.Id == g.Key.TargetId);
            return new
            {
                targetType = g.Key.TargetType,
                targetId = g.Key.TargetId,
                count = g.Count(),
                reasons = g.GroupBy(x => x.Reason).Select(x => new { reason = x.Key, count = x.Count() }),
                notes = g.Where(x => x.Note != null).Select(x => x.Note).Take(5),
                lastAt = g.Max(x => x.CreatedAt),
                target,
            };
        }).OrderByDescending(x => x.count).ThenByDescending(x => x.lastAt).ToList();

        return Ok(items);
    }

    // POST /api/admin/moderation/{type}/{id}/{op}  op = hide | unhide | dismiss
    // (route value can't be named "action" — reserved by MVC routing)
    [HttpPost("{type}/{id:guid}/{op}")]
    public async Task<IActionResult> Act(string type, Guid id, string op)
    {
        var action = op;
        if (type != "Review" && type != "Comment") return BadRequest(new { error = "Loại không hợp lệ." });
        if (action is not ("hide" or "unhide" or "dismiss")) return BadRequest(new { error = "Thao tác không hợp lệ." });

        if (action != "dismiss")
        {
            var hide = action == "hide";
            var n = type == "Review"
                ? await _db.GameReviews.Where(r => r.Id == id).ExecuteUpdateAsync(s => s.SetProperty(r => r.IsHidden, hide))
                : await _db.GameComments.Where(c => c.Id == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsHidden, hide));
            if (n == 0) return NotFound(new { error = "Không tìm thấy nội dung." });
        }
        var newStatus = action == "dismiss" ? "Dismissed" : "Hidden";
        if (action != "unhide")
            await _db.ContentReports.Where(r => r.TargetType == type && r.TargetId == id && r.Status == "Open")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, newStatus).SetProperty(r => r.ResolvedAt, DateTime.UtcNow));
        return NoContent();
    }

    // GET /api/admin/moderation/comments?search=&page=
    [HttpGet("comments")]
    public async Task<IActionResult> RecentComments([FromQuery] string? search, [FromQuery] int page = 1)
    {
        page = Math.Max(1, page);
        var q = from c in _db.GameComments.AsNoTracking()
                join g in _db.Games.AsNoTracking() on c.GameId equals g.Id
                select new { c.Id, c.ParentId, c.DisplayName, c.Content, c.IsHidden, c.CreatedAt, c.GameId, GameName = g.Name };
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(x => x.Content.ToLower().Contains(s) || x.DisplayName.ToLower().Contains(s) || x.GameName.ToLower().Contains(s));
        }
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * 30).Take(30).ToListAsync();
        return Ok(new { total, items });
    }
}
