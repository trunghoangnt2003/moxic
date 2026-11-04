using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Shared.Enums;

namespace Moxic.Infrastructure.Data;

public class MoxicDbContext : Microsoft.AspNetCore.Identity.EntityFrameworkCore.IdentityDbContext<IdentityUser>
{
    public MoxicDbContext(DbContextOptions<MoxicDbContext> options) : base(options) { }

    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameMedia> GameMedias => Set<GameMedia>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderDetail> OrderDetails => Set<OrderDetail>();
    public DbSet<PaymentConfig> PaymentConfigs => Set<PaymentConfig>();
    public DbSet<BankTransaction> BankTransactions => Set<BankTransaction>();
    public DbSet<LeaderboardAward> LeaderboardAwards => Set<LeaderboardAward>();
    public DbSet<GuessPuzzle> GuessPuzzles => Set<GuessPuzzle>();
    public DbSet<GuessPlay> GuessPlays => Set<GuessPlay>();
    public DbSet<GuessImage> GuessImages => Set<GuessImage>();
    public DbSet<FaqItem> FaqItems => Set<FaqItem>();
    public DbSet<Genre> Genres => Set<Genre>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<GameReview> GameReviews => Set<GameReview>();
    public DbSet<SpinPrize> SpinPrizes => Set<SpinPrize>();
    public DbSet<SpinCode> SpinCodes => Set<SpinCode>();
    public DbSet<SpinHistory> SpinHistories => Set<SpinHistory>();
    public DbSet<ContactSetting> ContactSettings => Set<ContactSetting>();
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<CustomerOtpCode> CustomerOtpCodes => Set<CustomerOtpCode>();
    public DbSet<SpinCase> SpinCases => Set<SpinCase>();
    public DbSet<SpinCaseCooldown> SpinCaseCooldowns => Set<SpinCaseCooldown>();
    public DbSet<PointsTransaction> PointsTransactions => Set<PointsTransaction>();
    public DbSet<SpinMusicTrack> SpinMusicTracks => Set<SpinMusicTrack>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<RewardItem> RewardItems => Set<RewardItem>();
    public DbSet<ChatThread> ChatThreads => Set<ChatThread>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ChatTelegramRef> ChatTelegramRefs => Set<ChatTelegramRef>();
    public DbSet<TelegramAdminChat> TelegramAdminChats => Set<TelegramAdminChat>();
    public DbSet<TelegramOrderMessage> TelegramOrderMessages => Set<TelegramOrderMessage>();
    public DbSet<RewardRedemption> RewardRedemptions => Set<RewardRedemption>();
    public DbSet<CouponRedemption> CouponRedemptions => Set<CouponRedemption>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<GameEdition> GameEditions => Set<GameEdition>();
    public DbSet<RentalPlan> RentalPlans => Set<RentalPlan>();
    public DbSet<RentalAsset> RentalAssets => Set<RentalAsset>();
    public DbSet<RentalAssetGame> RentalAssetGames => Set<RentalAssetGame>();
    public DbSet<RentalOrder> RentalOrders => Set<RentalOrder>();
    public DbSet<GamePriceSnapshot> GamePriceSnapshots => Set<GamePriceSnapshot>();
    public DbSet<GameComment> GameComments => Set<GameComment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<WebPushSubscription> WebPushSubscriptions => Set<WebPushSubscription>();
    public DbSet<ContentReport> ContentReports => Set<ContentReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityRole>().ToTable("aspnetroles");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUser>().ToTable("aspnetusers");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserRole<string>>().ToTable("aspnetuserroles");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityRoleClaim<string>>().ToTable("aspnetroleclaims");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserClaim<string>>().ToTable("aspnetuserclaims");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserLogin<string>>().ToTable("aspnetuserlogins");
		modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserToken<string>>().ToTable("aspnetusertokens");
        // Genre
        modelBuilder.Entity<Genre>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Tag
        modelBuilder.Entity<Tag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Game
        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasColumnType("text").IsRequired();
            entity.Property(e => e.ProductType).HasMaxLength(20).IsRequired().HasDefaultValue("Game");
            entity.Property(e => e.Region).HasMaxLength(30);
            entity.Property(e => e.Publisher).HasMaxLength(100);
            entity.Property(e => e.Developer).HasMaxLength(100);
            entity.Property(e => e.XboxProductId).HasMaxLength(20);
            entity.Property(e => e.PriceRegion).HasMaxLength(5);
            entity.HasIndex(e => e.ProductType);
            entity.Property(e => e.OriginalPrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SalePrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.HasIndex(e => e.IsFeatured);
            entity.HasIndex(e => e.Status);

            entity.HasMany(e => e.Genres)
                .WithMany()
                .UsingEntity(j => j.ToTable("GameGenre"));

            entity.HasMany(e => e.Tags)
                .WithMany()
                .UsingEntity(j => j.ToTable("GameTag"));

            entity.OwnsOne(e => e.SystemRequirements, builder => 
            {
                builder.ToJson();
                builder.OwnsOne(r => r.Minimum);
                builder.OwnsOne(r => r.Recommended);
            });
            entity.OwnsMany(e => e.Ratings, builder => builder.ToJson());
            entity.Property(e => e.RewardPoints).HasDefaultValue(0);
        });

        // GameMedia
        modelBuilder.Entity<GameMedia>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ObjectKey).HasMaxLength(500).IsRequired();
            entity.HasOne(e => e.Game)
                .WithMany(g => g.Media)
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.GameId, e.IsPrimary });
        });

        // Order
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.OrderCode).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.OrderCode).IsUnique();
            entity.Property(e => e.CustomerPhone).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CustomerXboxEmail).HasMaxLength(200).IsRequired();
            entity.Property(e => e.CustomerXboxPasswordEncrypted).HasMaxLength(500).IsRequired();
            entity.Property(e => e.CustomerZalo).HasMaxLength(100);
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.PaymentMethod)
                .HasConversion<string>()
                .HasMaxLength(10);
            // Customer account link (nullable, no FK — history also matches by email)
            entity.HasIndex(e => e.CustomerId);
            // Coupon (nullable FK, SET NULL; CouponCode is a snapshot)
            entity.Property(e => e.CouponCode).HasMaxLength(32);
            entity.Property(e => e.DiscountAmount).HasColumnType("decimal(18,2)").HasDefaultValue(0m);
            entity.HasOne<Coupon>()
                .WithMany()
                .HasForeignKey(e => e.CouponId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.CouponId);
            entity.Property(e => e.GiftToken).HasMaxLength(32);
            entity.HasIndex(e => e.GiftToken).IsUnique();
            entity.Property(e => e.GiftFromName).HasMaxLength(60);
            entity.Property(e => e.GiftRecipientName).HasMaxLength(60);
            entity.Property(e => e.GiftMessage).HasMaxLength(300);
            entity.Property(e => e.GiftRecipientPhone).HasMaxLength(20);
        });

        // OrderDetail
        modelBuilder.Entity<OrderDetail>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.GameName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.EditionName).HasMaxLength(60);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.ListPrice).HasColumnType("decimal(18,2)");
            entity.HasOne(e => e.Order)
                .WithMany(o => o.Details)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => new { e.OrderId, e.GameId }).IsUnique();
        });


        // GameReview
        modelBuilder.Entity<GameReview>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Content).HasMaxLength(500).IsRequired();
            entity.Property(e => e.AvatarUrl).HasMaxLength(500);
            entity.HasOne(e => e.Game)
                .WithMany(g => g.Reviews)
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.GameId);
        });
        // PaymentConfig
        modelBuilder.Entity<PaymentConfig>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BankBucketName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.BankQrObjectKey).HasMaxLength(500).IsRequired();
            entity.Property(e => e.CryptoBucketName).HasMaxLength(100);
            entity.Property(e => e.CryptoQrObjectKey).HasMaxLength(500);
            entity.Property(e => e.TransferSyntaxTemplate).HasMaxLength(256).IsRequired();
            entity.Property(e => e.BankCode).HasMaxLength(20);
        });
        modelBuilder.Entity<GuessPuzzle>(entity =>
        {
            entity.HasKey(e => e.Date);
            entity.Property(e => e.Date).HasMaxLength(10);
            entity.Property(e => e.ObjectKey).HasMaxLength(500).IsRequired();
            entity.HasIndex(e => e.GameId);
        });
        modelBuilder.Entity<FaqItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Question).HasMaxLength(300).IsRequired();
            entity.Property(e => e.Answer).HasMaxLength(3000).IsRequired();
        });
        modelBuilder.Entity<GuessImage>(entity =>
        {
            entity.HasKey(e => new { e.Date, e.Level });
            entity.Property(e => e.Date).HasMaxLength(10);
        });
        modelBuilder.Entity<GuessPlay>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Date).HasMaxLength(10).IsRequired();
            entity.Property(e => e.PlayerKey).HasMaxLength(80).IsRequired();
            entity.Property(e => e.UserId).HasMaxLength(450);
            entity.Property(e => e.Guesses).HasMaxLength(400).IsRequired();
            entity.HasIndex(e => new { e.Date, e.PlayerKey }).IsUnique();
            entity.HasIndex(e => new { e.UserId, e.Date });
        });
        modelBuilder.Entity<LeaderboardAward>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Month).HasMaxLength(7).IsRequired();
            entity.Property(e => e.Board).HasMaxLength(20).IsRequired();
            entity.Property(e => e.UserId).HasMaxLength(450).IsRequired();
            entity.Property(e => e.DisplayName).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => new { e.Month, e.Board, e.Rank }).IsUnique();
            entity.HasIndex(e => e.UserId);
        });
        modelBuilder.Entity<BankTransaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Provider).HasMaxLength(20).IsRequired();
            entity.Property(e => e.ProviderTxnId).HasMaxLength(64).IsRequired();
            entity.HasIndex(e => new { e.Provider, e.ProviderTxnId }).IsUnique();
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Content).HasMaxLength(500);
            entity.Property(e => e.Gateway).HasMaxLength(50);
            entity.Property(e => e.AccountNumber).HasMaxLength(50);
            entity.Property(e => e.ReferenceCode).HasMaxLength(100);
            entity.Property(e => e.Status).HasMaxLength(20).IsRequired();
            entity.Property(e => e.OrderCode).HasMaxLength(50);
            entity.Property(e => e.Note).HasMaxLength(300);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.OrderId);
        });

        // SpinPrize (lucky spin prize pool)
        modelBuilder.Entity<SpinPrize>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Type)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.Probability).HasPrecision(5, 2);
            entity.Property(e => e.DiscountType)
                .HasConversion<string>()
                .HasMaxLength(10);
            entity.Property(e => e.DiscountValue).HasPrecision(18, 2);
            entity.Property(e => e.DiscountMaxAmount).HasPrecision(18, 2);
            entity.Property(e => e.DiscountMinOrderAmount).HasPrecision(18, 2);
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.GameId);
            entity.HasOne(e => e.Case)
                .WithMany(c => c.Prizes)
                .HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CaseId);
        });

        // SpinCode
        modelBuilder.Entity<SpinCode>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).HasMaxLength(32).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Note).HasMaxLength(200);
            entity.HasOne(e => e.Case)
                .WithMany()
                .HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CaseId);
        });

        // SpinHistory
        modelBuilder.Entity<SpinHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CodeText).HasMaxLength(32).IsRequired();
            entity.Property(e => e.PrizeName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.PrizeType)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.RewardCode).HasMaxLength(32);
            entity.Property(e => e.ClientIp).HasMaxLength(64);
            entity.HasOne<SpinCode>()
                .WithMany()
                .HasForeignKey(e => e.SpinCodeId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<SpinPrize>()
                .WithMany()
                .HasForeignKey(e => e.PrizeId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.RewardCode).IsUnique();
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.CaseName).HasMaxLength(100);
            entity.Property(e => e.OpenMethod)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.UserEmail).HasMaxLength(256);
            entity.Property(e => e.PointsSpent).HasDefaultValue(0);
            entity.Property(e => e.Rarity).HasMaxLength(20);
            entity.HasOne<SpinCase>()
                .WithMany()
                .HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.CaseId);
            entity.HasIndex(e => e.UserId);
        });

        // SpinCase (lucky-spin case / "hòm")
        modelBuilder.Entity<WebPushSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Endpoint).HasMaxLength(1000).IsRequired();
            entity.Property(e => e.P256dh).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Auth).HasMaxLength(100).IsRequired();
            entity.HasOne<IdentityUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.Endpoint).IsUnique();
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Title).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Body).HasMaxLength(500);
            entity.Property(e => e.Link).HasMaxLength(300);
            entity.HasOne<IdentityUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
        });

        modelBuilder.Entity<GameComment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DisplayName).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Content).HasMaxLength(1000).IsRequired();
            entity.HasOne<Game>().WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<GameComment>().WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.GameId, e.CreatedAt });
        });

        modelBuilder.Entity<ContentReport>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TargetType).HasMaxLength(20).IsRequired();
            entity.Property(e => e.ReporterIp).HasMaxLength(64);
            entity.Property(e => e.Reason).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Note).HasMaxLength(300);
            entity.Property(e => e.Status).HasMaxLength(20).IsRequired();
            entity.HasIndex(e => new { e.Status, e.CreatedAt });
        });

        modelBuilder.Entity<GamePriceSnapshot>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Source).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Region).HasMaxLength(5).IsRequired();
            entity.Property(e => e.Currency).HasMaxLength(5).IsRequired();
            entity.Property(e => e.BasePrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SalePrice).HasColumnType("decimal(18,2)");
            entity.HasOne<Game>().WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.GameId, e.Source, e.CapturedAt });
        });

        modelBuilder.Entity<RentalPlan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.HasOne(e => e.Game).WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.GameId);
        });

        modelBuilder.Entity<RentalAsset>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Label).HasMaxLength(60).IsRequired();
            entity.Property(e => e.LoginEmail).HasMaxLength(200).IsRequired();
            entity.Property(e => e.PasswordEncrypted).HasMaxLength(1000).IsRequired();
            entity.Property(e => e.Notes).HasMaxLength(500);
        });

        modelBuilder.Entity<RentalAssetGame>(entity =>
        {
            entity.HasKey(e => new { e.AssetId, e.GameId });
            entity.HasOne(e => e.Asset).WithMany(a => a.Games).HasForeignKey(e => e.AssetId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game).WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.GameId);
        });

        modelBuilder.Entity<RentalOrder>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).HasMaxLength(40).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Kind).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CustomerEmail).HasMaxLength(256).IsRequired();
            entity.Property(e => e.CustomerPhone).HasMaxLength(20);
            entity.Property(e => e.GameName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status).HasMaxLength(30).IsRequired();
            entity.Property(e => e.AdminNote).HasMaxLength(500);
            entity.Property(e => e.CancelReason).HasMaxLength(300);
            entity.HasOne(e => e.Parent).WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game).WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Asset).WithMany().HasForeignKey(e => e.AssetId).OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => new { e.AssetId, e.Status });
        });

        modelBuilder.Entity<GameEdition>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(60).IsRequired();
            entity.Property(e => e.Includes).HasMaxLength(2000);
            entity.Property(e => e.OriginalPrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SalePrice).HasColumnType("decimal(18,2)");
            entity.HasOne(e => e.Game).WithMany(g => g.Editions).HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.GameId);
        });

        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.GameId });
            entity.Property(e => e.NotifiedPrice).HasColumnType("decimal(18,2)");
            entity.HasOne(e => e.Game).WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Microsoft.AspNetCore.Identity.IdentityUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.GameId);
        });

        modelBuilder.Entity<Announcement>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Kind).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Title).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Subtitle).HasMaxLength(300);
            entity.Property(e => e.Body).HasMaxLength(2000);
            entity.Property(e => e.ImageObjectKey).HasMaxLength(500);
            entity.Property(e => e.CountdownLabel).HasMaxLength(100);
            entity.Property(e => e.CtaLabel).HasMaxLength(60);
            entity.Property(e => e.CtaUrl).HasMaxLength(500);
            entity.HasOne(e => e.Game).WithMany().HasForeignKey(e => e.GameId).OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => new { e.IsActive, e.Priority });
        });

        modelBuilder.Entity<SpinCase>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Slug).HasMaxLength(80).IsRequired();
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.ImageObjectKey).HasMaxLength(500);
            entity.Property(e => e.OpenMethod)
                .HasConversion<string>()
                .HasMaxLength(20);
        });

        // SpinCaseCooldown (last free open per customer + case)
        modelBuilder.Entity<SpinCaseCooldown>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.CaseId });
            entity.HasOne<SpinCase>()
                .WithMany()
                .HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<IdentityUser>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CaseId);
        });

        // Live chat (web ↔ Telegram)
        modelBuilder.Entity<ChatThread>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).HasMaxLength(8).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.AccessKeyHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(e => e.AccessKeyHash).IsUnique();
            entity.Property(e => e.UserId).HasMaxLength(450);
            entity.HasIndex(e => e.UserId);
            entity.Property(e => e.Name).HasMaxLength(60);
            entity.Property(e => e.Contact).HasMaxLength(100);
            entity.Property(e => e.OrderCode).HasMaxLength(50);
            entity.HasIndex(e => e.LastMessageAt);
        });
        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Text).HasMaxLength(2000).IsRequired();
            entity.Property(e => e.OrderCode).HasMaxLength(50);
            entity.Property(e => e.Via).HasMaxLength(10);
            entity.HasOne<ChatThread>().WithMany().HasForeignKey(e => e.ThreadId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.ThreadId, e.CreatedAt });
            entity.HasIndex(e => e.OrderCode);
        });
        modelBuilder.Entity<ChatTelegramRef>(entity =>
        {
            entity.HasKey(e => new { e.TelegramChatId, e.TelegramMessageId });
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne<ChatThread>().WithMany().HasForeignKey(e => e.ThreadId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<TelegramOrderMessage>(entity =>
        {
            entity.HasKey(e => new { e.ChatId, e.MessageId });
            entity.HasIndex(e => e.OrderId);
        });
        modelBuilder.Entity<TelegramAdminChat>(entity =>
        {
            entity.HasKey(e => e.ChatId);
            entity.Property(e => e.ChatId).ValueGeneratedNever();
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        // Points shop
        modelBuilder.Entity<RewardItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(300);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.DiscountType).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.DiscountValue).HasColumnType("decimal(18,2)");
            entity.Property(e => e.DiscountMaxAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.DiscountMinOrderAmount).HasColumnType("decimal(18,2)");
        });
        modelBuilder.Entity<RewardRedemption>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ItemName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.IssuedCode).HasMaxLength(32).IsRequired();
            entity.HasOne<IdentityUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => new { e.RewardItemId, e.UserId });
        });

        // PointsTransaction (loyalty points ledger)
        modelBuilder.Entity<PointsTransaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Reason)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.RefId).HasMaxLength(64);
            entity.Property(e => e.Note).HasMaxLength(200);
            entity.Property(e => e.CreatedBy).HasMaxLength(256);
            entity.HasOne<IdentityUser>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => new { e.Reason, e.RefId }).IsUnique();
        });

        // Coupon (event promo codes + spin reward coupons)
        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).HasMaxLength(32).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Source)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.DiscountType)
                .HasConversion<string>()
                .HasMaxLength(10);
            entity.Property(e => e.Value).HasPrecision(18, 2);
            entity.Property(e => e.MaxDiscountAmount).HasPrecision(18, 2);
            entity.Property(e => e.MinOrderAmount).HasPrecision(18, 2);
            entity.Property(e => e.CreatedBy).HasMaxLength(256);
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasIndex(e => new { e.Source, e.CreatedAt });
        });

        // CouponRedemption (append-only usage ledger; one per order)
        modelBuilder.Entity<CouponRedemption>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            entity.HasOne(e => e.Coupon)
                .WithMany(c => c.Redemptions)
                .HasForeignKey(e => e.CouponId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Order)
                .WithMany()
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.OrderId).IsUnique();
            entity.HasIndex(e => new { e.CouponId, e.UserId });
        });

        // SpinMusicTrack (case-page music library)
        modelBuilder.Entity<SpinMusicTrack>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.ObjectKey).HasMaxLength(500).IsRequired();
            entity.Property(e => e.ContentType).HasMaxLength(50).IsRequired();
        });

        // ContactSetting (singleton)
        modelBuilder.Entity<ContactSetting>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.MessengerUrl).HasMaxLength(500);
            entity.Property(e => e.Zalo).HasMaxLength(500);
            entity.Property(e => e.PhoneNumber).HasMaxLength(30);
        });

        // CustomerProfile (1:1 with IdentityUser)
        modelBuilder.Entity<CustomerProfile>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.DisplayName).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Points).HasDefaultValue(0);
            entity.Property(e => e.ReferralCode).HasMaxLength(16);
            entity.HasIndex(e => e.ReferralCode).IsUnique().HasFilter("\"ReferralCode\" IS NOT NULL");
            entity.HasOne<IdentityUser>()
                .WithOne()
                .HasForeignKey<CustomerProfile>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // CustomerOtpCode (hashed email-verification / password-reset codes)
        modelBuilder.Entity<CustomerOtpCode>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Purpose)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.CodeHash).HasMaxLength(200).IsRequired();
            entity.HasOne<IdentityUser>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.Purpose });
        });
    }
}


