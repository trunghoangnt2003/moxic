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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Game
        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasColumnType("text").IsRequired();
            entity.Property(e => e.OriginalPrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SalePrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Genre).HasMaxLength(100);
            entity.Property(e => e.Tags).HasMaxLength(500);
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.HasIndex(e => new { e.Status, e.Genre });
            entity.HasIndex(e => e.IsFeatured);
            
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
