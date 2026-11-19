using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InventoryProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AfterOpeningMonths",
                schema: "khypupyme",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "products_after_opening_months",
                schema: "khypupyme",
                table: "products",
                sql: " \"AfterOpeningMonths\" IS NULL OR (\"Brand\" IS NOT NULL AND \"AfterOpeningMonths\" BETWEEN 1 AND 120) ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "products_after_opening_months",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "AfterOpeningMonths",
                schema: "khypupyme",
                table: "products");
        }
    }
}
