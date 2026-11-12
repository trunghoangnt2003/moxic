using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Tests;

/// <summary>The real service graph (Identity, points, coupons, statuses, share) over a TestDb, minus email/Telegram I/O.</summary>
public static class TestServices
{
    public static ServiceProvider Build(TestDb db, RecordingShareEvents? events = null)
    {
        var s = new ServiceCollection();
        s.AddLogging();
        s.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        s.AddDbContext<MoxicDbContext>(o => o.UseNpgsql(db.ConnectionString));
        s.AddIdentityCore<IdentityUser>().AddRoles<IdentityRole>().AddEntityFrameworkStores<MoxicDbContext>();
        s.AddSingleton<IDataProtectionProvider>(ShareTestKit.Protection);
        s.AddSingleton<CountingEmailQueue>();
        s.AddSingleton<IBackgroundEmailQueue>(sp => sp.GetRequiredService<CountingEmailQueue>());
        s.AddScoped<PushService>();
        s.AddScoped<NotificationService>();
        s.AddScoped<PointsService>();
        s.AddScoped<CouponService>();
        s.AddScoped<OrderStatusService>();
        s.AddSingleton<IShareEvents>(events ?? new RecordingShareEvents());
        s.AddScoped<ShareRoomService>();
        return s.BuildServiceProvider();
    }

    /// <summary>Makes A/B/C verified customers (role "Customer").</summary>
    public static async Task MakeCustomersAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        if (!await roles.RoleExistsAsync(CustomerAuthRules.CustomerRole)) await roles.CreateAsync(new IdentityRole(CustomerAuthRules.CustomerRole));
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        foreach (var id in new[] { ShareTestKit.A.UserId, ShareTestKit.B.UserId, ShareTestKit.C.UserId })
        {
            var u = await users.FindByIdAsync(id);
            if (u != null && !await users.IsInRoleAsync(u, CustomerAuthRules.CustomerRole)) await users.AddToRoleAsync(u, CustomerAuthRules.CustomerRole);
        }
    }
}
