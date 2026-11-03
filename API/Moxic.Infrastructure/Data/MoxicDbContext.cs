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
        });

        // OrderDetail
        modelBuilder.Entity<OrderDetail>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.GameName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
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


