using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Moxic.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSpinCasesPointsMusic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CaseId",
                table: "SpinPrizes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "CaseId",
                table: "SpinHistories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CaseName",
                table: "SpinHistories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OpenMethod",
                table: "SpinHistories",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PointsSpent",
                table: "SpinHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Rarity",
                table: "SpinHistories",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserEmail",
                table: "SpinHistories",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "SpinHistories",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CaseId",
                table: "SpinCodes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "PointsAwardedAt",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RewardPoints",
                table: "Games",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PointsTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Delta = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RefId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    BalanceAfter = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointsTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PointsTransactions_aspnetusers_UserId",
                        column: x => x.UserId,
                        principalTable: "aspnetusers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SpinCases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ImageObjectKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OpenMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FreeIntervalHours = table.Column<int>(type: "integer", nullable: false),
                    PointsCost = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpinCases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SpinMusicTracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpinMusicTracks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SpinCaseCooldowns",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    CaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastOpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpinCaseCooldowns", x => new { x.UserId, x.CaseId });
                    table.ForeignKey(
                        name: "FK_SpinCaseCooldowns_SpinCases_CaseId",
                        column: x => x.CaseId,
                        principalTable: "SpinCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SpinCaseCooldowns_aspnetusers_UserId",
                        column: x => x.UserId,
                        principalTable: "aspnetusers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpinPrizes_CaseId",
                table: "SpinPrizes",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SpinHistories_CaseId",
                table: "SpinHistories",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SpinHistories_UserId",
                table: "SpinHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SpinCodes_CaseId",
                table: "SpinCodes",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_PointsTransactions_Reason_RefId",
                table: "PointsTransactions",
                columns: new[] { "Reason", "RefId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PointsTransactions_UserId_CreatedAt",
                table: "PointsTransactions",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SpinCaseCooldowns_CaseId",
                table: "SpinCaseCooldowns",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SpinCases_Slug",
                table: "SpinCases",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SpinCodes_SpinCases_CaseId",
                table: "SpinCodes",
                column: "CaseId",
                principalTable: "SpinCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SpinHistories_SpinCases_CaseId",
                table: "SpinHistories",
                column: "CaseId",
                principalTable: "SpinCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SpinPrizes_SpinCases_CaseId",
                table: "SpinPrizes",
                column: "CaseId",
                principalTable: "SpinCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SpinCodes_SpinCases_CaseId",
                table: "SpinCodes");

            migrationBuilder.DropForeignKey(
                name: "FK_SpinHistories_SpinCases_CaseId",
                table: "SpinHistories");

            migrationBuilder.DropForeignKey(
                name: "FK_SpinPrizes_SpinCases_CaseId",
                table: "SpinPrizes");

            migrationBuilder.DropTable(
                name: "PointsTransactions");

            migrationBuilder.DropTable(
                name: "SpinCaseCooldowns");

            migrationBuilder.DropTable(
                name: "SpinMusicTracks");

            migrationBuilder.DropTable(
                name: "SpinCases");

            migrationBuilder.DropIndex(
                name: "IX_SpinPrizes_CaseId",
                table: "SpinPrizes");

            migrationBuilder.DropIndex(
                name: "IX_SpinHistories_CaseId",
                table: "SpinHistories");

            migrationBuilder.DropIndex(
                name: "IX_SpinHistories_UserId",
                table: "SpinHistories");

            migrationBuilder.DropIndex(
                name: "IX_SpinCodes_CaseId",
                table: "SpinCodes");

            migrationBuilder.DropColumn(
                name: "CaseId",
                table: "SpinPrizes");

            migrationBuilder.DropColumn(
                name: "CaseId",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "CaseName",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "OpenMethod",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "PointsSpent",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "Rarity",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "UserEmail",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SpinHistories");

            migrationBuilder.DropColumn(
                name: "CaseId",
                table: "SpinCodes");

            migrationBuilder.DropColumn(
                name: "PointsAwardedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RewardPoints",
                table: "Games");
        }
    }
}
