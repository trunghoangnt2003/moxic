using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Moxic.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGameExtendedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Games",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Ratings",
                table: "Games",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SystemRequirements",
                table: "Games",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Games_IsFeatured",
                table: "Games",
                column: "IsFeatured");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Games_IsFeatured",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "IsFeatured",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Ratings",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "SystemRequirements",
                table: "Games");
        }
    }
}
