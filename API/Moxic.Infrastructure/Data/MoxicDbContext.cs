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
    }
}


