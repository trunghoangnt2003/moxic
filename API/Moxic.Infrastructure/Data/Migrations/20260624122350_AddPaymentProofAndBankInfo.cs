using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Moxic.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentProofAndBankInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccountHolder",
                table: "PaymentConfigs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "PaymentConfigs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "PaymentConfigs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentProofObjectKey",
                table: "Orders",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankAccountHolder",
                table: "PaymentConfigs");

            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "PaymentConfigs");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "PaymentConfigs");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentProofObjectKey",
                table: "Orders");
        }
    }
}
