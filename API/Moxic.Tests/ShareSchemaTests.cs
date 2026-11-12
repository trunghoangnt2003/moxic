using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Tests;

public class ShareSchemaTests
{
    [Fact]
    public async Task Bootstrap_upgrades_an_existing_database_and_room_roundtrips()
    {
        await using var db = await TestDb.CreateAsync();
        await using (var ctx = db.NewContext())
        {
            // Simulate a production database created before share rooms existed.
            await ctx.Database.ExecuteSqlRawAsync("""
                DROP TABLE "ShareMessages"; DROP TABLE "ShareSeats"; DROP TABLE "ShareRooms";
                ALTER TABLE "Games" DROP COLUMN "AllowShare";
                ALTER TABLE "Orders" DROP COLUMN "ShareRoomId";
                ALTER TABLE "Orders" DROP COLUMN "ProvidedAccountEmail";
                ALTER TABLE "Orders" DROP COLUMN "ProvidedAccountPasswordEncrypted";
                DROP INDEX "IX_CouponRedemptions_OrderId"; DROP INDEX "IX_CouponRedemptions_OrderId_UserId";
                CREATE UNIQUE INDEX "IX_CouponRedemptions_OrderId" ON "CouponRedemptions" ("OrderId");
                """);
            await ShareRoomSchemaBootstrap.EnsureAsync(ctx);
            await ShareRoomSchemaBootstrap.EnsureAsync(ctx); // idempotent
        }

        var roomId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using (var ctx = db.NewContext())
        {
            ctx.ShareRooms.Add(new ShareRoom
            {
                Id = roomId, Code = "MX7K2Q", GameId = Guid.NewGuid(), GameName = "Forza", TotalPrice = 900000,
                OwnerUserId = "u1", CreatedAt = now, UpdatedAt = now,
                Seats =
                {
                    new ShareSeat { Id = Guid.NewGuid(), UserId = "u1", DisplayName = "Minh", IsOwner = true, Percent = 60, ShareAmount = 540000, AmountDue = 540000, PaymentCode = "MXR11111111", JoinedAt = now },
                    new ShareSeat { Id = Guid.NewGuid(), UserId = "u2", DisplayName = "Hoàng", Percent = 40, ShareAmount = 360000, AmountDue = 360000, JoinedAt = now },
                },
            });
            ctx.ShareMessages.Add(new ShareMessage { Id = Guid.NewGuid(), RoomId = roomId, Text = "Xin chào", CreatedAt = now });
            await ctx.SaveChangesAsync();
        }
        await using (var ctx = db.NewContext())
        {
            var room = await ctx.ShareRooms.Include(r => r.Seats).SingleAsync(r => r.Id == roomId);
            Assert.Equal(2, room.Seats.Count);
            Assert.Equal(1, await ctx.ShareMessages.CountAsync(m => m.RoomId == roomId));
            Assert.False(await ctx.Games.AnyAsync(g => g.AllowShare));
            Assert.False(await ctx.Orders.AnyAsync(o => o.ShareRoomId != null));
            var unique = await ctx.Database.SqlQueryRaw<bool>("""SELECT x.indisunique AS "Value" FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid WHERE c.relname = 'IX_CouponRedemptions_OrderId'""").SingleAsync();
            Assert.False(unique);
        }
    }
}
