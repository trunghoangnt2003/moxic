using Moxic.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

public static class GameReviewSeeder
{
    private static readonly string[] UserNames =
    [
        "Minh Anh", "Hoàng Long", "Thu Trang", "Đức Huy", "Phương Linh",
        "Tuấn Kiệt", "Bảo Ngọc", "Thanh Tùng", "Mai Chi", "Quốc Bình"
    ];

    private static readonly string[] Contents =
    [
        "Lần đầu mua trên Moxic, hơi lo nhưng cài game nhanh và uy tín. Sẽ ủng hộ dài dài!",
        "Mua game thứ 3 rồi, giá rẻ hơn Store nhiều. Anh chủ support nhiệt tình lắm ạ.",
        "Đặt GTA VI pre-order, giá tốt nhất mình tìm được. Chờ ngày ra mắt thôi!",
        "Cài game trong 20 phút, không phải lo gì. Store uy tín, recommend cho ae.",
        "So sánh giá thì Moxic rẻ hơn hẳn, quan trọng là uy tín. Mua đi đừng ngại!",
        "Hơi nghi ngờ vì giá rẻ quá, nhưng anh chủ tư vấn kỹ và cài game thành công.",
        "Đã mua Elden Ring bản Deluxe, giá chỉ bằng nửa Store. Anh chủ support tận tình.",
        "Lần 3 mua ở đây rồi, chưa bao giờ thất vọng. Cài nhanh - gọn - uy tín.",
        "Pre-order game mới nhất, giá ưu đãi hơn hẳn bên ngoài. Tin tưởng Moxic!",
        "Được bạn giới thiệu, thử mua 1 lần. Từ đó thành khách quen luôn. 5 sao nhé!"
    ];

    private static readonly (int Rating, double Weight)[] RatingPool =
    [
        (5, 0.7),
        (4, 0.3)
    ];

    public static async Task SeedAsync(MoxicDbContext context)
    {
        if (await context.GameReviews.AnyAsync()) return;

        var games = await context.Games.AsNoTracking().ToListAsync();
        var random = new Random(42);
        var reviews = new List<GameReview>();

        foreach (var game in games)
        {
            var count = random.Next(5, 9); // 5-8 reviews per game
            var usedIndices = new HashSet<int>();

            for (int i = 0; i < count; i++)
            {
                var userIdx = random.Next(UserNames.Length);
                var contentIdx = random.Next(Contents.Length);

                var roll = random.NextDouble();
                var rating = roll < 0.7 ? 5 : 4;

                var daysAgo = random.Next(1, 60);
                var createdAt = DateTime.UtcNow.AddDays(-daysAgo).AddHours(random.Next(1, 24));

                var avatarKey = $"review-{game.Id}-{i}";

                reviews.Add(new GameReview
                {
                    Id = Guid.NewGuid(),
                    GameId = game.Id,
                    UserName = UserNames[userIdx],
                    AvatarUrl = $"https://i.pravatar.cc/40?u={avatarKey}",
                    Rating = rating,
                    Content = Contents[contentIdx],
                    CreatedAt = createdAt
                });
            }
        }

        context.GameReviews.AddRange(reviews);
        await context.SaveChangesAsync();
    }
}
