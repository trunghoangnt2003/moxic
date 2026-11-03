using Moxic.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

public static class GenreTagSeeder
{
    public static async Task SeedAsync(MoxicDbContext context)
    {
        if (!await context.Genres.AnyAsync())
        {
            var genres = new List<Genre>
            {
                new() { Id = Guid.NewGuid(), Name = "Action" },
                new() { Id = Guid.NewGuid(), Name = "Adventure" },
                new() { Id = Guid.NewGuid(), Name = "RPG" },
                new() { Id = Guid.NewGuid(), Name = "Action RPG" },
                new() { Id = Guid.NewGuid(), Name = "Action Adventure" },
                new() { Id = Guid.NewGuid(), Name = "Simulation" },
                new() { Id = Guid.NewGuid(), Name = "Strategy" },
                new() { Id = Guid.NewGuid(), Name = "Sports" },
                new() { Id = Guid.NewGuid(), Name = "Racing" },
                new() { Id = Guid.NewGuid(), Name = "Horror" },
                new() { Id = Guid.NewGuid(), Name = "Shooter" },
                new() { Id = Guid.NewGuid(), Name = "Puzzle" },
                new() { Id = Guid.NewGuid(), Name = "Indie" },
                new() { Id = Guid.NewGuid(), Name = "Open World" },
            };
            context.Genres.AddRange(genres);
        }

        if (!await context.Tags.AnyAsync())
        {
            var tags = new List<Tag>
            {
                new() { Id = Guid.NewGuid(), Name = "Hot" },
                new() { Id = Guid.NewGuid(), Name = "Bestseller" },
                new() { Id = Guid.NewGuid(), Name = "Preorder" },
                new() { Id = Guid.NewGuid(), Name = "New" },
                new() { Id = Guid.NewGuid(), Name = "Coming Soon" },
                new() { Id = Guid.NewGuid(), Name = "Sale" },
            };
            context.Tags.AddRange(tags);
        }

        await context.SaveChangesAsync();
    }
}
