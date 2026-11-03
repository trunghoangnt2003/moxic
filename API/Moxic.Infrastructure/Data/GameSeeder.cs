using Moxic.Core.Entities;
using Moxic.Shared.Enums;
using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

public static class GameSeeder
{
    public static async Task SeedAsync(MoxicDbContext context)
    {
        if (await context.Games.AnyAsync()) return;

        var t1Min = new SystemRequirement { Os = "Windows 10 64-bit", Processor = "Intel Core i5-8400 / AMD Ryzen 3 3300X", Memory = "12 GB RAM", Graphics = "NVIDIA GeForce GTX 1060 6GB / AMD Radeon RX 580", Storage = "100 GB SSD" };
        var t1Rec = new SystemRequirement { Os = "Windows 11 64-bit", Processor = "Intel Core i7-8700K / AMD Ryzen 5 3600X", Memory = "16 GB RAM", Graphics = "NVIDIA GeForce RTX 2070 / AMD Radeon RX 6700 XT", Storage = "100 GB SSD" };

        // Load seeded genres/tags
        var actionRpg = await context.Genres.FirstAsync(g => g.Name == "Action RPG");
        var actionAdventure = await context.Genres.FirstAsync(g => g.Name == "Action Adventure");
        var hot = await context.Tags.FirstAsync(t => t.Name == "Hot");
        var bestseller = await context.Tags.FirstAsync(t => t.Name == "Bestseller");
        var preorder = await context.Tags.FirstAsync(t => t.Name == "Preorder");

        var games = new List<Game>
        {
            new Game
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "ELDEN RING",
                OriginalPrice = 1499000,
                SalePrice = 749000,
                Genres = new List<Genre> { actionRpg },
                Tags = new List<Tag> { hot, bestseller },
                Status = GameStatus.Available,
                IsFeatured = false,
                Description = "ELDEN RING là game hành động nhập vai phiêu lưu trong thế giới Vòng Địa Ngục rộng lớn...",
                SystemRequirements = new SystemRequirementData { Minimum = t1Min, Recommended = t1Rec },
                Ratings = new List<GameRating>
                {
                    new() { Source = "Metacritic", Score = 96, MaxScore = 100, Label = "Đánh giá chung" },
                    new() { Source = "OpenCritic", Score = 94, MaxScore = 100, Label = "Nhà phê bình" }
                },
                Media = new List<GameMedia>
                {
                    new() { Id = Guid.NewGuid(), ObjectKey = "https://images7.alphacoders.com/439/439636.jpg", IsPrimary = true, DisplayOrder = 1 }
                }
            },
            new Game
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                Name = "Grand Theft Auto VI",
                OriginalPrice = 1799000,
                SalePrice = 1799000,
                Genres = new List<Genre> { actionAdventure },
                Tags = new List<Tag> { hot, preorder },
                Status = GameStatus.Preorder,
                IsFeatured = true,
                Description = "GTA VI đưa người chơi trở lại Vice City...",
                SystemRequirements = new SystemRequirementData { Minimum = t1Min, Recommended = t1Rec },
                Ratings = new List<GameRating>(),
                Media = new List<GameMedia>
                {
                    new() { Id = Guid.NewGuid(), ObjectKey = "https://picsum.photos/seed/gta6-cover/400/500", IsPrimary = true, DisplayOrder = 1 }
                }
            }
        };

        context.Games.AddRange(games);
        await context.SaveChangesAsync();
    }
}
