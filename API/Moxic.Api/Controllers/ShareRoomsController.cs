using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>
/// Share rooms (2 customers buy one game together). Reading open rooms and a room's summary is public;
/// everything else needs a verified customer.
/// </summary>
[ApiController]
public class ShareRoomsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly ShareRoomService _shares;
    private readonly CommunityService _community;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;

    public ShareRoomsController(MoxicDbContext db, ShareRoomService shares, CommunityService community, IMinioService minio, IConfiguration config)
    {
        _db = db;
        _shares = shares;
        _community = community;
        _minio = minio;
        _config = config;
    }

    private static string T(string vi, string en) => RequestLanguage.T(vi, en);
    private IActionResult SignIn() => Unauthorized(new { error = T("Vui lòng đăng nhập (email đã xác minh).", "Please sign in with a verified email.") });
    private Task<CustomerIdentity?> MeAsync() => _community.GetCustomerAsync(HttpContext);

    private async Task<Dictionary<Guid, string?>> CoversAsync(IEnumerable<Guid> gameIds)
    {
        var ids = gameIds.Distinct().ToList();
        var media = await _db.GameMedias.AsNoTracking()
            .Where(m => ids.Contains(m.GameId) && !m.ObjectKey.EndsWith(".mp4") && !m.ObjectKey.EndsWith(".webm"))
            .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
            .Select(m => new { m.GameId, m.ObjectKey }).ToListAsync();
        var result = new Dictionary<Guid, string?>();
        foreach (var m in media)
        {
            if (result.ContainsKey(m.GameId)) continue;
            string? url = null;
            try { url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, m.ObjectKey); } catch { }
            result[m.GameId] = url;
        }
        return result;
    }

    private async Task<ShareRoomDto> DtoAsync(ShareRoom room, string? viewerId)
    {
        var dto = await _shares.ViewAsync(room, viewerId);
        dto.CoverUrl = (await CoversAsync(new[] { room.GameId })).GetValueOrDefault(room.GameId);
        var mine = room.Seats.FirstOrDefault(s => s.UserId == viewerId && s.LeftAt == null);
        if (mine?.PaymentCode != null)
        {
            var cfg = await _db.PaymentConfigs.AsNoTracking().FirstOrDefaultAsync();
            var paid = mine.PaidAt != null;
            var remaining = Math.Max(0, mine.AmountDue - mine.PaidAmount);
            dto.MyPayment = new ShareMyPaymentDto(mine.PaymentCode, mine.AmountDue, mine.PaidAmount, paid,
                paid ? null : BankPaymentService.VietQrUrl(cfg, remaining, mine.PaymentCode),
                cfg?.BankName, cfg?.BankAccountNumber, cfg?.BankAccountHolder, !string.IsNullOrWhiteSpace(_config["Sepay:ApiKey"]));
        }
        return dto;
    }

    private async Task<IActionResult> RoomResult(string code, string? viewerId)
    {
        var room = await _shares.LoadAsync(code);
        return room == null ? NotFound(new { error = T("Không tìm thấy phòng share.", "Share room not found.") }) : Ok(await DtoAsync(room, viewerId));
    }

    // GET /api/share?gameId=&accountType=Owner|Moxic&percent=50&sort=new|ending&page=1
    [HttpGet("api/share")]
    public async Task<IActionResult> List([FromQuery] Guid? gameId, [FromQuery] string? accountType, [FromQuery] int? percent,
        [FromQuery] string? sort, [FromQuery] int page = 1)
    {
        var rooms = await _shares.ListOpenAsync(gameId, accountType, percent, sort, page, 24);
        var covers = await CoversAsync(rooms.Select(r => r.GameId));
        var owners = rooms.Select(r => r.Seats.First(s => s.IsOwner && s.LeftAt == null)).ToList();
        var counts = await _shares.ShareCountsAsync(owners.Select(o => o.UserId));
        return Ok(rooms.Select(r =>
        {
            var owner = r.Seats.First(s => s.IsOwner && s.LeftAt == null);
            return new ShareRoomCardDto(r.Code, r.GameId, r.GameName, covers.GetValueOrDefault(r.GameId), r.AccountType, owner.Percent,
                100 - owner.Percent, r.TotalPrice - owner.ShareAmount, r.TotalPrice, ShareRules.RoomExpiry(r.CreatedAt), owner.DisplayName,
                counts.GetValueOrDefault(owner.UserId), r.CreatedAt);
        }));
    }

    // GET /api/share/{code}
    [HttpGet("api/share/{code}")]
    public async Task<IActionResult> Get(string code) => await RoomResult(code, (await MeAsync())?.UserId);

    // POST /api/share
    [HttpPost("api/share")]
    public async Task<IActionResult> Create([FromBody] CreateShareRoomBody body)
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var (room, error) = await _shares.CreateAsync(me, new CreateShareRoomRequest(body.GameId, body.EditionId, body.AccountType, body.OwnerPercent, body.IsPublic));
        return room == null ? BadRequest(new { error }) : Ok(await DtoAsync(room, me.UserId));
    }

    private async Task<IActionResult> Act(string code, Func<CustomerIdentity, Task<string?>> action)
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var error = await action(me);
        if (error != null) return BadRequest(new { error });
        return await RoomResult(code, me.UserId);
    }

    [HttpPost("api/share/{code}/join")]
    public Task<IActionResult> Join(string code) => Act(code, async me => (await _shares.JoinAsync(code, me)).Error);

    [HttpPost("api/share/{code}/leave")]
    public Task<IActionResult> Leave(string code) => Act(code, async me => (await _shares.LeaveAsync(code, me.UserId)).Error);

    [HttpPost("api/share/{code}/kick")]
    public Task<IActionResult> Kick(string code) => Act(code, async me => (await _shares.KickAsync(code, me.UserId)).Error);

    [HttpPost("api/share/{code}/cancel")]
    public Task<IActionResult> Cancel(string code) => Act(code, async me => (await _shares.CancelAsync(code, me.UserId)).Error);

    [HttpPut("api/share/{code}/percent")]
    public Task<IActionResult> Percent(string code, [FromBody] SharePercentBody body) =>
        Act(code, async me => (await _shares.SetPercentAsync(code, me.UserId, body.Percent)).Error);

    [HttpPut("api/share/{code}/coupon")]
    public Task<IActionResult> Coupon(string code, [FromBody] ShareCouponBody body) =>
        Act(code, async me => (await _shares.ApplyCouponAsync(code, me.UserId, body.Code)).Error);

    [HttpPut("api/share/{code}/xbox")]
    public Task<IActionResult> Xbox(string code, [FromBody] ShareXboxBody body) =>
        Act(code, async me => (await _shares.SetOwnerXboxAsync(code, me.UserId, body.Email, body.Password)).Error);

    [HttpPost("api/share/{code}/pay")]
    public Task<IActionResult> Pay(string code) => Act(code, async me => (await _shares.StartPaymentAsync(code, me.UserId)).Error);

    // GET /api/share/{code}/messages?after=2026-11-12T10:00:00Z
    [HttpGet("api/share/{code}/messages")]
    public async Task<IActionResult> Messages(string code, [FromQuery] DateTime? after)
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var list = await _shares.MessagesAsync(code, me.UserId, after?.ToUniversalTime(), RequestLanguage.IsEnglish);
        return list == null ? NotFound(new { error = T("Chỉ thành viên phòng mới xem được thảo luận.", "Only room members can see the chat.") }) : Ok(list);
    }

    [HttpPost("api/share/{code}/messages")]
    public async Task<IActionResult> Post(string code, [FromBody] ShareMessageBody body)
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var (msg, error) = await _shares.PostMessageAsync(code, me.UserId, body.Text);
        return msg == null ? BadRequest(new { error }) : Ok(new ShareMessageDto(msg.Id, me.DisplayName, true, false, msg.Text, false, msg.CreatedAt));
    }

    [HttpPost("api/share/{code}/messages/{id:guid}/report")]
    public async Task<IActionResult> Report(string code, Guid id)
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var error = await _shares.ReportMessageAsync(code, me.UserId, id);
        return error == null ? Ok(new { ok = true }) : BadRequest(new { error });
    }

    // GET /api/account/share — rooms I'm in or was in
    [HttpGet("api/account/share")]
    public async Task<IActionResult> Mine()
    {
        var me = await MeAsync();
        if (me == null) return SignIn();
        var rooms = await _shares.MyRoomsAsync(me.UserId);
        var covers = await CoversAsync(rooms.Select(r => r.GameId));
        var list = new List<ShareRoomDto>();
        foreach (var r in rooms)
        {
            var dto = await _shares.ViewAsync(r, me.UserId);
            dto.CoverUrl = covers.GetValueOrDefault(r.GameId);
            list.Add(dto);
        }
        return Ok(list);
    }
}
