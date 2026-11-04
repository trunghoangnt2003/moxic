using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using Minio;
using Moxic.Api.Endpoints;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Infrastructure.Services;
using Moxic.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database - KhuyÃªn dÃ¹ng thÃªm .UseSnakeCaseNamingConvention() náº¿u cháº¡y Postgres trÃªn Linux
AppContext.SetSwitch("Npgsql.EnableDateTimeUtcConversion", true);

builder.Services.AddDbContext<MoxicDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Identity
builder.Services.AddDefaultIdentity<IdentityUser>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.User.RequireUniqueEmail = true;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<MoxicDbContext>();

// --- Cáº¤U HÃŒNH COOKIE CHUáº¨N Äá»‚ Sá»¬ Dá»¤NG CHÃ‰O Cá»”NG (CORS / DOCKER) ---
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Account/Login";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";
    
    // Báº¯t buá»™c cáº¥u hÃ¬nh nÃ y Ä‘á»ƒ cookie cÃ³ thá»ƒ bay qua bay láº¡i giá»¯a port 3001/3002 vÃ  port 8080 trÃªn IP Public
    options.Cookie.SameSite = SameSiteMode.Lax; 
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // SameSite = None thÃ¬ báº¯t buá»™c pháº£i Ä‘i kÃ¨m Secure (HTTPS/SSL)
    options.Cookie.HttpOnly = true; 
    options.Cookie.Name = "MoxicAuthCookie";

    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = 401;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

// Customer (storefront) cookie scheme — separate from the admin Identity.Application cookie.
// AddAuthentication() without a scheme argument keeps Identity.Application as the default.
builder.Services.AddAuthentication()
    .AddCookie(CustomerAuthRules.Scheme, options =>
    {
        options.Cookie.Name = CustomerAuthRules.CookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = CustomerAuthRules.ValidatePrincipalAsync;
    });
builder.Services.AddScoped<CustomerOtpService>();

// Lucky-spin cases + loyalty points
builder.Services.AddMemoryCache();
builder.Services.AddScoped<PointsService>();
builder.Services.AddScoped<RewardShopService>();
// Live chat (web <-> Telegram)
builder.Services.AddHttpClient(TelegramBot.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddSingleton<TelegramBot>();
builder.Services.AddScoped<ChatService>();
builder.Services.AddScoped<TelegramOrderNotifier>();
builder.Services.AddScoped<OrderStatusService>();
builder.Services.AddHostedService<TelegramChatPoller>();
builder.Services.AddScoped<CouponService>();
builder.Services.AddScoped<RentalService>();
builder.Services.AddScoped<CommunityService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<PushService>();
builder.Services.AddHttpClient(PriceTrackerService.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddScoped<PriceTrackerService>();
builder.Services.AddHostedService<PriceTrackerJob>();
builder.Services.AddHostedService<RentalMaintenanceService>();
builder.Services.AddSingleton<SpinUserRateLimiter>();

// MinIO
builder.Services.Configure<MinioSettings>(builder.Configuration.GetSection("Minio"));
builder.Services.AddSingleton<IMinioClient>(sp =>
{
    var settings = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MinioSettings>>().Value;
    return new MinioClient()
        .WithEndpoint(settings.Endpoint)
        .WithCredentials(settings.AccessKey, settings.SecretKey)
        .WithSSL(settings.WithSSL)
        .Build();
});
builder.Services.AddScoped<IMinioService, MinioService>();

// Data Protection
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, ".keys")));

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetValue<string>("Cors:Origins");
        if (!string.IsNullOrEmpty(origins))
        {
            policy.WithOrigins(origins.Split(',').Select(o => o.Trim()).ToArray())
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials(); // Báº¯t buá»™c pháº£i cÃ³ Ä‘á»ƒ cho phÃ©p nháº­n/gá»­i kÃ¨m Cookie
        }
        else
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
    });
});

// Email & Background Services
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddSingleton<IBackgroundEmailQueue, BackgroundEmailQueue>();
builder.Services.AddHostedService<EmailProcessingService>();
builder.Services.AddHostedService<PaymentTimeoutService>();

// Controllers + Razor Pages
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddRazorPages();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT Authorization header using the Bearer scheme."
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("bearer", document)] = []
    });
});

// Rate limiting (lucky-spin public endpoint: 10 req / minute / IP, 429 on rejection)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(LuckySpinRules.RateLimitPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            LuckySpinRules.GetClientIp(ctx),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    // Customer auth endpoints (register/login/verify/resend/forgot/reset) + admin login: 10 req / minute / IP
    options.AddPolicy(CustomerAuthRules.RateLimitPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            LuckySpinRules.GetClientIp(ctx),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    // Coupon validate / claim / order creation: 20 req / minute / IP (anti-enumeration)
    options.AddPolicy(CouponRules.RateLimitPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            LuckySpinRules.GetClientIp(ctx),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// KÃ­ch hoáº¡t Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Moxic API v1");
    });
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapRazorPages();

// Endpoint Auth Login
app.MapPost("/api/auth/login", async (SignInManager<IdentityUser> signInManager, UserManager<IdentityUser> userManager, LoginRequest req) =>
{
    // Admin SPA only: reject non-Admin users (e.g. customers) BEFORE any cookie is issued.
    var user = string.IsNullOrWhiteSpace(req.Email) ? null : await userManager.FindByEmailAsync(req.Email.Trim());
    if (user == null || !await userManager.IsInRoleAsync(user, CustomerAuthRules.AdminRole))
        return Results.Unauthorized();

    var result = await signInManager.PasswordSignInAsync(user, req.Password, isPersistent: true, lockoutOnFailure: false);
    if (result.Succeeded) return Results.Ok();
    return Results.Unauthorized();
})
.RequireRateLimiting(CustomerAuthRules.RateLimitPolicy);

// Database Initialization (EnsureCreated & Seed Data)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var dbContext = services.GetRequiredService<MoxicDbContext>();

    try
    {
        // Sá»­ dá»¥ng duy nháº¥t EnsureCreatedAsync cho gá»n nháº¹ Ä‘á»‘i vá»›i Code-First khÃ´ng cáº§n Migration lá»‹ch sá»­
        await dbContext.Database.EnsureCreatedAsync();
        // Ensure GameReviews table exists (for existing databases where EnsureCreated is no-op)
        await dbContext.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""GameReviews"" (
                ""Id"" uuid NOT NULL,
                ""GameId"" uuid NOT NULL,
                ""UserName"" text NOT NULL,
                ""AvatarUrl"" text NULL,
                ""Rating"" integer NOT NULL,
                ""Content"" text NOT NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL,
                CONSTRAINT ""PK_GameReviews"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_GameReviews_Games_GameId"" FOREIGN KEY (""GameId"") REFERENCES ""Games""(""Id"") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ""IX_GameReviews_GameId"" ON ""GameReviews"" (""GameId"");
        ");
        await CatalogSchemaBootstrap.EnsureAsync(dbContext);
        await LuckySpinSchemaBootstrap.EnsureAsync(dbContext);
        await CustomerAccountSchemaBootstrap.EnsureAsync(dbContext);
        await LuckySpinCasesSchemaBootstrap.EnsureAsync(dbContext);
        await CouponSchemaBootstrap.EnsureAsync(dbContext);
        await AnnouncementSchemaBootstrap.EnsureAsync(dbContext);
        await WishlistSchemaBootstrap.EnsureAsync(dbContext);
        await RentalSchemaBootstrap.EnsureAsync(dbContext);
        await PriceTrackingSchemaBootstrap.EnsureAsync(dbContext);
        await CommunitySchemaBootstrap.EnsureAsync(dbContext);
        await ShoppingSchemaBootstrap.EnsureAsync(dbContext);
        
        // Khá»Ÿi táº¡o Role Admin
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new IdentityRole("Admin"));
        }
        // Storefront customer role
        if (!await roleManager.RoleExistsAsync(CustomerAuthRules.CustomerRole))
        {
            await roleManager.CreateAsync(new IdentityRole(CustomerAuthRules.CustomerRole));
        }

        // Khá»Ÿi táº¡o User Admin máº·c Ä‘á»‹nh
        var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
        var adminEmail = "admin@moxic.com";
        if (await userManager.FindByEmailAsync(adminEmail) == null)
        {
            var admin = new IdentityUser { UserName = adminEmail, Email = adminEmail };
            var result = await userManager.CreateAsync(admin, "Admin@123");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, "Admin");
            }
        }

        // Seed cÃ¡c dá»¯ liá»‡u nghiá»‡p vá»¥
        await GenreTagSeeder.SeedAsync(dbContext);
        await GameSeeder.SeedAsync(dbContext);
        await GameReviewSeeder.SeedAsync(dbContext);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "CÃ³ lá»—i xáº£y ra trong quÃ¡ trÃ¬nh khá»Ÿi táº¡o Database.");
    }
}

app.MapGameEndpoints();
app.Run();

public record LoginRequest(string Email, string Password);

