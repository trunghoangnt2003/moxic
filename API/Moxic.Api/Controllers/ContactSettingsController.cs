using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>Public floating-contact settings with server-resolved hrefs.</summary>
[Route("api/contact-settings")]
[ApiController]
public class ContactSettingsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public ContactSettingsController(MoxicDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var row = await _db.ContactSettings.AsNoTracking().OrderBy(c => c.Id).FirstOrDefaultAsync();
        var phoneHref = ContactLinks.ResolvePhoneHref(row?.PhoneNumber);

        return Ok(new
        {
            messengerUrl = ContactLinks.ResolveMessenger(row?.MessengerUrl),
            zaloUrl = ContactLinks.ResolveZalo(row?.Zalo),
            phoneNumber = phoneHref != null ? row!.PhoneNumber!.Trim() : null,
            phoneHref
        });
    }
}
