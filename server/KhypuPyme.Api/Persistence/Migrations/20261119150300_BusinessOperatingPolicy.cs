using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BusinessOperatingPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowNewCredit",
                schema: "khypupyme",
                table: "business_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultPayment",
                schema: "khypupyme",
                table: "business_settings",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "cash");

            migrationBuilder.AddColumn<int>(
                name: "LotAlertDays",
                schema: "khypupyme",
                table: "business_settings",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<int>(
                name: "MaxDiscountPercent",
                schema: "khypupyme",
                table: "business_settings",
                type: "integer",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.AddColumn<int>(
                name: "PolicyRevision",
                schema: "khypupyme",
                table: "business_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "QuoteDays",
                schema: "khypupyme",
                table: "business_settings",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddCheckConstraint(
                name: "business_settings_days",
                schema: "khypupyme",
                table: "business_settings",
                sql: "\"QuoteDays\" BETWEEN 1 AND 90 AND \"LotAlertDays\" BETWEEN 1 AND 90");

            migrationBuilder.AddCheckConstraint(
                name: "business_settings_discount",
                schema: "khypupyme",
                table: "business_settings",
                sql: "\"MaxDiscountPercent\" BETWEEN 0 AND 100");

            migrationBuilder.AddCheckConstraint(
                name: "business_settings_payment",
                schema: "khypupyme",
                table: "business_settings",
                sql: "\"DefaultPayment\" IN ('cash', 'qr', 'transfer')");

            migrationBuilder.AddCheckConstraint(
                name: "business_settings_revision",
                schema: "khypupyme",
                table: "business_settings",
                sql: "\"PolicyRevision\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "business_settings_days",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropCheckConstraint(
                name: "business_settings_discount",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropCheckConstraint(
                name: "business_settings_payment",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropCheckConstraint(
                name: "business_settings_revision",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "AllowNewCredit",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "DefaultPayment",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "LotAlertDays",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "MaxDiscountPercent",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "PolicyRevision",
                schema: "khypupyme",
                table: "business_settings");

            migrationBuilder.DropColumn(
                name: "QuoteDays",
                schema: "khypupyme",
                table: "business_settings");
        }
    }
}
