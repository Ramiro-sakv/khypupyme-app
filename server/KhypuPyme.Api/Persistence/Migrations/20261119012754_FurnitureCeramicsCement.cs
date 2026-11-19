using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FurnitureCeramicsCement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CementSourceId",
                schema: "khypupyme",
                table: "products",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaterialJson",
                schema: "khypupyme",
                table: "products",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "furniture_deliveries",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mode = table.Column<string>(type: "text", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    CompletedOn = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_furniture_deliveries", x => new { x.BusinessId, x.SaleId });
                    table.CheckConstraint("furniture_delivery_mode", " \"Mode\" IN ('pickup','delivery') AND (\"Mode\" = 'pickup' OR \"Address\" IS NOT NULL) ");
                    table.ForeignKey(
                        name: "FK_furniture_deliveries_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_furniture_deliveries_commerce_entries_BusinessId_SaleId",
                        columns: x => new { x.BusinessId, x.SaleId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_CementSourceId",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "CementSourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_furniture_deliveries_BusinessId_Day",
                schema: "khypupyme",
                table: "furniture_deliveries",
                columns: new[] { "BusinessId", "Day" });

            migrationBuilder.Sql("""
                ALTER TABLE khypupyme.furniture_deliveries ENABLE ROW LEVEL SECURITY;
                CREATE POLICY commerce_business ON khypupyme.furniture_deliveries USING (
                    "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                    AND EXISTS (SELECT 1 FROM khypupyme.businesses b WHERE b."Id" = "BusinessId")
                );
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_products_products_BusinessId_CementSourceId",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "CementSourceId" },
                principalSchema: "khypupyme",
                principalTable: "products",
                principalColumns: new[] { "BusinessId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_products_products_BusinessId_CementSourceId",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropTable(
                name: "furniture_deliveries",
                schema: "khypupyme");

            migrationBuilder.DropIndex(
                name: "IX_products_BusinessId_CementSourceId",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "CementSourceId",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "MaterialJson",
                schema: "khypupyme",
                table: "products");
        }
    }
}
