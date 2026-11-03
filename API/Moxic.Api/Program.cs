using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
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
    options.Password.RequiredLength = 6;
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
app.MapControllers();
app.MapRazorPages();

// Endpoint Auth Login
app.MapPost("/api/auth/login", async (SignInManager<IdentityUser> signInManager, LoginRequest req) =>
{
    var result = await signInManager.PasswordSignInAsync(req.Email, req.Password, isPersistent: true, lockoutOnFailure: false);
    if (result.Succeeded) return Results.Ok();
    return Results.Unauthorized();
});

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
        
        // Khá»Ÿi táº¡o Role Admin
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new IdentityRole("Admin"));
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

