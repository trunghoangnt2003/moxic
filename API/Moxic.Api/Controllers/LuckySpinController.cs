using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>
/// Public lucky-spin case endpoints. The server is the single source of truth: the open method is
/// consumed atomically (code use / free-open cooldown / points) inside one transaction, then the
/// winner is drawn with the CSPRNG. The client only animates to the returned index + stop offset.
/// </summary>
[Route("api/lucky-spin")]
[ApiController]
public class LuckySpinController : ControllerBase
{
    private const int PreviewPrizeCount = 5;
    private const string RateLimitedMessage = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly PointsService _points;
    private readonly SpinUserRateLimiter _userLimiter;

    public LuckySpinController(
        MoxicDbContext db,
        IMinioService minio,
        IConfiguration config,
        UserManager<IdentityUser> userManager,
        PointsService points,
        SpinUserRateLimiter userLimiter)
    {
        _db = db;
        _minio = minio;
        _config = config;
        _userManager = userManager;
        _points = points;
        _userLimiter = userLimiter;
    }

    // GET /api/lucky-spin/cases?page=1&pageSize=24&method=&q=
    [HttpGet("cases")]
    public async Task<IActionResult> GetCases(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 24,
        [FromQuery] string? method = null, [FromQuery] string? q = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 48);

        var query = _db.SpinCases.AsNoTracking().Where(c => c.IsActive);
        if (!string.IsNullOrWhiteSpace(method)
            && Enum.TryParse<SpinCaseOpenMethod>(method.Trim(), true, out var m)
            && Enum.IsDefined(m))
        {
            query = query.Where(c => c.OpenMethod == m);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            if (term.Length > 100) term = term[..100];
            term = term.ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(term));
        }

        var total = await query.CountAsync();
        var cases = await query
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // One query for every case on the page (no N+1), grouped in memory.
        var caseIds = cases.Select(c => c.Id).ToList();
        var prizes = await _db.SpinPrizes.AsNoTracking()
            .Include(p => p.Game).ThenInclude(g => g!.Media)
            .Where(p => p.IsActive && caseIds.Contains(p.CaseId))
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync();
        var prizesByCase = prizes.GroupBy(p => p.CaseId).ToDictionary(g => g.Key, g => g.ToList());

        var customer = await GetCustomerAsync();
        var cooldowns = new Dictionary<Guid, DateTime>();
        if (customer != null)
        {
            cooldowns = await _db.SpinCaseCooldowns.AsNoTracking()
                .Where(cd => cd.UserId == customer.Value.UserId && caseIds.Contains(cd.CaseId))
                .ToDictionaryAsync(cd => cd.CaseId, cd => cd.LastOpenedAt);
        }

        var now = DateTime.UtcNow;
        var items = new List<PublicCaseSummaryDto>();
        foreach (var c in cases)
        {
            var casePrizes = prizesByCase.TryGetValue(c.Id, out var list) ? list : new List<SpinPrize>();
            DateTime? nextFree = null;
            if (c.OpenMethod == SpinCaseOpenMethod.FreeInterval && cooldowns.TryGetValue(c.Id, out var last))
            {
                nextFree = NextFreeOpenAt(last, c, now);
            }
            items.Add(await BuildSummaryAsync(c, casePrizes, nextFree));
        }

        return Ok(new PublicCasesResponse(items, total, page, pageSize, customer != null, now));
    }

    // GET /api/lucky-spin/cases/{slug}
    [HttpGet("cases/{slug}")]
    public async Task<IActionResult> GetCase(string slug)
    {
        var c = await FindActiveCaseAsync(slug);
        if (c == null) return NotFound(new { error = "Không tìm thấy hòm." });

        var prizes = await LoadActivePrizesAsync(c.Id);
        var available = LuckySpinRules.IsPoolValid(prizes);
        var now = DateTime.UtcNow;

        var customer = await GetCustomerAsync();
        DateTime? nextFree = null;
        int? points = null;
        var emailVerified = false;
        if (customer != null)
        {
            emailVerified = customer.Value.User.EmailConfirmed;
            points = await _points.GetBalanceAsync(customer.Value.UserId);
            if (c.OpenMethod == SpinCaseOpenMethod.FreeInterval)
            {
                nextFree = await NextFreeOpenAtAsync(customer.Value.UserId, c, now);
            }
        }

        var loggedIn = customer != null;
        var canOpen = c.OpenMethod switch
        {
            SpinCaseOpenMethod.Code => available,
            SpinCaseOpenMethod.FreeInterval => available && loggedIn && emailVerified && nextFree == null,
            SpinCaseOpenMethod.Points => available && loggedIn && emailVerified && c.PointsCost > 0 && (points ?? 0) >= c.PointsCost,
            _ => false
        };

        var images = await ResolveImagesAsync(prizes);
        var summary = await BuildSummaryAsync(c, prizes, nextFree, images);
        return Ok(new PublicCaseDetailDto(
            summary,
            prizes.Select(p => ToPublic(p, images)).ToList(),
            new CaseViewerDto(loggedIn, emailVerified, points, nextFree, canOpen),
            now));
    }

    // POST /api/lucky-spin/cases/{slug}/open
    [HttpPost("cases/{slug}/open")]
    [EnableRateLimiting(LuckySpinRules.RateLimitPolicy)]
    public async Task<IActionResult> OpenCase(string slug, [FromBody] OpenCaseRequest? request)
    {
        // (1) case
        var spinCase = await FindActiveCaseAsync(slug);
        if (spinCase == null) return NotFound(new { error = "Không tìm thấy hòm." });

        // (2) pool must be valid BEFORE anything is consumed
        var prizes = await LoadActivePrizesAsync(spinCase.Id);
        if (!LuckySpinRules.IsPoolValid(prizes))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "Hòm đang được cấu hình, vui lòng quay lại sau." });

        // (3) caller + method preconditions
        var customer = await GetCustomerAsync();
        string? code = null;
        if (spinCase.OpenMethod == SpinCaseOpenMethod.Code)
        {
            code = LuckySpinRules.NormalizeCode(request?.Code);
            if (code == null)
            {
                var msg = string.IsNullOrWhiteSpace(request?.Code) ? "Vui lòng nhập mã quay." : "Mã quay không hợp lệ.";
                return BadRequest(new { error = msg });
            }
        }
        else
        {
            if (customer == null)
                return StatusCode(StatusCodes.Status401Unauthorized,
                    new { error = "Vui lòng đăng nhập để mở hòm này.", code = "LOGIN_REQUIRED" });
            if (!customer.Value.User.EmailConfirmed)
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { error = "Vui lòng xác minh email trước khi mở hòm.", code = "EMAIL_NOT_VERIFIED" });
            if (!_userLimiter.TryAcquire(customer.Value.UserId))
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error = RateLimitedMessage });
            if (spinCase.OpenMethod == SpinCaseOpenMethod.Points && spinCase.PointsCost < 1)
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { error = "Hòm đang được cấu hình, vui lòng quay lại sau." });
        }

        // (4) one transaction for consume + draw + history
        var spinId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync();

        // (5) consume atomically
        Guid? spinCodeId = null;
        int? remainingUses = null;
        int pointsSpent = 0;
        int? pointsBalance = null;
        DateTime? nextFreeOpenAt = null;

        switch (spinCase.OpenMethod)
        {
            case SpinCaseOpenMethod.Code:
            {
                // Single conditional UPDATE: PostgreSQL re-checks the WHERE under the row lock.
                var caseId = spinCase.Id;
                var affected = await _db.SpinCodes
                    .Where(c => c.Code == code
                                && c.CaseId == caseId
                                && c.IsActive
                                && c.UsedCount < c.MaxUses
                                && (c.ExpiresAt == null || c.ExpiresAt > now))
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1));

                if (affected == 0)
                {
                    await tx.RollbackAsync();
                    var existing = await _db.SpinCodes.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
                    string reason;
                    if (existing == null) reason = "Mã quay không hợp lệ.";
                    else if (existing.CaseId != caseId) reason = "Mã quay không thuộc hòm này.";
                    else if (!existing.IsActive) reason = "Mã quay đã bị vô hiệu hóa.";
                    else if (existing.ExpiresAt != null && existing.ExpiresAt <= now) reason = "Mã quay đã hết hạn.";
                    else reason = "Mã quay đã hết lượt sử dụng.";
                    return BadRequest(new { error = reason });
                }

                var codeRow = await _db.SpinCodes.AsNoTracking()
                    .Where(c => c.Code == code)
                    .Select(c => new { c.Id, c.MaxUses, c.UsedCount })
                    .FirstAsync();
                spinCodeId = codeRow.Id;
                remainingUses = Math.Max(0, codeRow.MaxUses - codeRow.UsedCount);
                break;
            }
            case SpinCaseOpenMethod.FreeInterval:
            {
                var userId = customer!.Value.UserId;
                var caseId = spinCase.Id;
                var threshold = now.AddHours(-spinCase.FreeIntervalHours);
                // Conditional upsert on PK (UserId, CaseId): inserts the first open, otherwise only
                // updates when the previous open is older than the interval. Concurrent requests
                // serialize on the row, so only one can win per interval.
                var affected = await _db.Database.ExecuteSqlAsync($"""
                    INSERT INTO "SpinCaseCooldowns" ("UserId", "CaseId", "LastOpenedAt")
                    VALUES ({userId}, {caseId}, {now})
                    ON CONFLICT ("UserId", "CaseId") DO UPDATE SET "LastOpenedAt" = EXCLUDED."LastOpenedAt"
                    WHERE "SpinCaseCooldowns"."LastOpenedAt" <= {threshold}
                    """);
                if (affected == 0)
                {
                    await tx.RollbackAsync();
                    var next = await NextFreeOpenAtAsync(userId, spinCase, now) ?? now;
                    return Conflict(new
                    {
                        error = RequestLanguage.T($"Bạn đã dùng lượt miễn phí. Lượt tiếp theo sẽ mở sau {LuckySpinRules.FormatWaitVi(next - now)}.", $"You've used your free spin. The next one opens in {LuckySpinRules.FormatWaitEn(next - now)}."),
                        code = "COOLDOWN",
                        nextFreeOpenAt = next
                    });
                }
                nextFreeOpenAt = now.AddHours(spinCase.FreeIntervalHours);
                break;
            }
            case SpinCaseOpenMethod.Points:
            {
                var cost = spinCase.PointsCost;
                var (ok, balance) = await _points.TrySpendAsync(customer!.Value.UserId, cost, spinId.ToString(), spinCase.Name);
                if (!ok)
                {
                    await tx.RollbackAsync();
                    return Conflict(new
                    {
                        error = RequestLanguage.T($"Bạn không đủ điểm để mở hòm này (cần {cost} điểm).", $"You don't have enough points to open this case ({cost} points needed)."),
                        code = "INSUFFICIENT_POINTS",
                        pointsBalance = balance,
                        pointsCost = cost
                    });
                }
                pointsSpent = cost;
                pointsBalance = balance;
                break;
            }
            default:
                await tx.RollbackAsync();
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { error = "Hòm đang được cấu hình, vui lòng quay lại sau." });
        }

        // (6) the ONLY outcome decision — CSPRNG over the configured odds
        var winner = LuckySpinRules.PickPrize(prizes);

        // (7) unique reward code for non-Luck wins
        string? rewardCode = null;
        if (winner.Type != SpinPrizeType.Luck)
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var candidate = LuckySpinRules.GenerateRewardCode();
                // Unique across spin reward codes AND coupon codes (a Discount win may become a coupon).
                if (!await _db.SpinHistories.AnyAsync(h => h.RewardCode == candidate)
                    && !await _db.Coupons.AnyAsync(c => c.Code == candidate))
                {
                    rewardCode = candidate;
                    break;
                }
            }
            if (rewardCode == null)
            {
                await tx.RollbackAsync();
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { error = "Không thể mở hòm lúc này, vui lòng thử lại." });
            }
        }

        // (8) history snapshot
        var email = customer?.User.Email;
        var history = new SpinHistory
        {
            Id = spinId,
            CaseId = spinCase.Id,
            CaseName = spinCase.Name,
            OpenMethod = spinCase.OpenMethod,
            SpinCodeId = spinCodeId,
            CodeText = code ?? string.Empty,
            PrizeId = winner.Id,
            PrizeName = winner.Name,
            PrizeType = winner.Type,
            GameId = winner.GameId,
            RewardCode = rewardCode,
            IsClaimed = false,
            UserId = customer?.UserId,
            UserEmail = email == null ? null : (email.Length > 256 ? email[..256] : email),
            PointsSpent = pointsSpent,
            Rarity = LuckySpinRules.RarityFor(winner.Probability),
            ClientIp = LuckySpinRules.GetClientIp(HttpContext),
            CreatedAt = now
        };
        _db.SpinHistories.Add(history);

        // (8b) configured Discount prize -> real SpinReward coupon, in the same transaction (T-smv-10).
        // Verified logged-in customers own it immediately; guests claim it later from the wallet.
        var ownerUserId = customer != null && customer.Value.User.EmailConfirmed ? customer.Value.UserId : null;
        var coupon = rewardCode == null ? null : CouponRules.TryBuildSpinRewardCoupon(winner, rewardCode, spinId, ownerUserId, now);
        if (coupon != null)
        {
            _db.Coupons.Add(coupon);
            if (coupon.OwnerUserId != null)
            {
                history.IsClaimed = true;
                history.ClaimedAt = now;
            }
        }
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        // (9) cosmetic reel built server-side AFTER the draw
        var layout = LuckySpinRules.BuildReel(prizes, winner);
        var images = await ResolveImagesAsync(prizes);

        return Ok(new OpenCaseResultDto(
            spinId,
            spinCase.Slug,
            ToPublic(winner, images),
            rewardCode,
            remainingUses,
            pointsSpent,
            pointsBalance,
            nextFreeOpenAt,
            layout.WinningIndex,
            layout.StopOffset,
            layout.Cards.Select(p => ToPublic(p, images)).ToList(),
            coupon != null,
            coupon?.OwnerUserId != null,
            coupon?.ExpiresAt));
    }

    // GET /api/lucky-spin/code-lookup?code= — which case does this spin code open?
    [HttpGet("code-lookup")]
    [EnableRateLimiting(LuckySpinRules.RateLimitPolicy)]
    public async Task<IActionResult> LookupCode([FromQuery] string? code)
    {
        var normalized = LuckySpinRules.NormalizeCode(code);
        var notFound = NotFound(new { error = "Mã quay không hợp lệ hoặc đã hết lượt." });
        if (normalized == null) return notFound;

        var now = DateTime.UtcNow;
        var slug = await _db.SpinCodes.AsNoTracking()
            .Where(c => c.Code == normalized
                        && c.IsActive
                        && c.UsedCount < c.MaxUses
                        && (c.ExpiresAt == null || c.ExpiresAt > now)
                        && c.Case != null
                        && c.Case.IsActive
                        && c.Case.OpenMethod == SpinCaseOpenMethod.Code)
            .Select(c => c.Case!.Slug)
            .FirstOrDefaultAsync();

        return slug == null ? notFound : Ok(new { slug });
    }

    // ───────────────────────── helpers ─────────────────────────

    /// <summary>Logged-in storefront customer (MoxicCustomer scheme + Customer role), or null.</summary>
    private async Task<(string UserId, IdentityUser User)?> GetCustomerAsync()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        if (!auth.Succeeded || auth.Principal == null || !auth.Principal.IsInRole(CustomerAuthRules.CustomerRole))
            return null;
        var userId = auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return null;
        var user = await _userManager.FindByIdAsync(userId);
        return user == null ? null : (userId, user);
    }

    private async Task<SpinCase?> FindActiveCaseAsync(string slug)
    {
        var s = (slug ?? string.Empty).Trim().ToLowerInvariant();
        if (s.Length == 0 || s.Length > 80) return null;
        return await _db.SpinCases.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == s && c.IsActive);
    }

    private async Task<List<SpinPrize>> LoadActivePrizesAsync(Guid caseId) =>
        await _db.SpinPrizes.AsNoTracking()
            .Include(p => p.Game).ThenInclude(g => g!.Media)
            .Where(p => p.IsActive && p.CaseId == caseId)
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync();

    private static DateTime? NextFreeOpenAt(DateTime lastOpenedAt, SpinCase c, DateTime now)
    {
        var next = lastOpenedAt.AddHours(c.FreeIntervalHours);
        return next > now ? next : null;
    }

    private async Task<DateTime?> NextFreeOpenAtAsync(string userId, SpinCase c, DateTime now)
    {
        var caseId = c.Id;
        var last = await _db.SpinCaseCooldowns.AsNoTracking()
            .Where(cd => cd.UserId == userId && cd.CaseId == caseId)
            .Select(cd => (DateTime?)cd.LastOpenedAt)
            .FirstOrDefaultAsync();
        return last == null ? null : NextFreeOpenAt(last.Value, c, now);
    }

    private async Task<PublicCaseSummaryDto> BuildSummaryAsync(
        SpinCase c, IReadOnlyList<SpinPrize> activePrizes, DateTime? nextFreeOpenAt,
        IReadOnlyDictionary<Guid, string?>? knownImages = null)
    {
        var preview = activePrizes
            .OrderBy(p => LuckySpinRules.RarityRank(LuckySpinRules.RarityFor(p.Probability)))
            .ThenBy(p => p.DisplayOrder)
            .Take(PreviewPrizeCount)
            .ToList();
        var images = knownImages ?? await ResolveImagesAsync(preview);

        string? imageUrl = null;
        if (!string.IsNullOrEmpty(c.ImageObjectKey))
        {
            try
            {
                var bucket = _config.GetValue<string>("Minio:GamesBucket") ?? LuckySpinRules.GameBucket;
                imageUrl = await _minio.GetPresignedUrlAsync(bucket, c.ImageObjectKey, PresignExpiryHours());
            }
            catch
            {
                imageUrl = null;
            }
        }

        return new PublicCaseSummaryDto(
            c.Id,
            c.Slug,
            RequestLanguage.Pick(c.Name, c.NameEn),
            c.Description == null && string.IsNullOrWhiteSpace(c.DescriptionEn) ? null : RequestLanguage.Pick(c.Description ?? "", c.DescriptionEn),
            imageUrl,
            c.OpenMethod,
            c.FreeIntervalHours,
            c.PointsCost,
            LuckySpinRules.IsPoolValid(activePrizes),
            activePrizes.Count,
            preview.Select(p => ToPublic(p, images)).ToList(),
            nextFreeOpenAt,
            c.OpenMethod == SpinCaseOpenMethod.Code ? c.CodePrice : 0);
    }

    private int PresignExpiryHours()
    {
        var hours = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        return hours > 0 ? hours : 1;
    }

    private async Task<Dictionary<Guid, string?>> ResolveImagesAsync(IEnumerable<SpinPrize> prizes)
    {
        var map = new Dictionary<Guid, string?>();
        foreach (var p in prizes)
        {
            if (map.ContainsKey(p.Id)) continue;
            map[p.Id] = await LuckySpinRules.ResolveImageUrlAsync(_minio, p);
        }
        return map;
    }

    private static PublicPrizeDto ToPublic(SpinPrize p, IReadOnlyDictionary<Guid, string?> images) =>
        new(p.Id, RequestLanguage.Pick(p.Name, !string.IsNullOrWhiteSpace(p.NameEn) ? p.NameEn : p.Game?.NameEn), p.Type, LuckySpinRules.RarityFor(p.Probability), p.GameId,
            images.TryGetValue(p.Id, out var url) ? url : null);
}
