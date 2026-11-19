using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SpecialtyCommerce : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CountUnit",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetailBrand",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetailJson",
                schema: "khypupyme",
                table: "products",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetailModel",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MeasureLabel",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PartsJson",
                schema: "khypupyme",
                table: "products",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrintingColor",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrintingSize",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reference",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RollLength",
                schema: "khypupyme",
                table: "products",
                type: "numeric(12,3)",
                precision: 12,
                scale: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Shelf",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "part_references",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Reference = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_part_references", x => new { x.BusinessId, x.ProductId, x.Key });
                    table.ForeignKey(
                        name: "FK_part_references_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_part_references_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "product_fitments",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Brand = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    BrandKey = table.Column<string>(type: "text", nullable: false),
                    ModelKey = table.Column<string>(type: "text", nullable: false),
                    FromYear = table.Column<int>(type: "integer", nullable: false),
                    ToYear = table.Column<int>(type: "integer", nullable: false),
                    Confirmed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_fitments", x => new { x.BusinessId, x.ProductId, x.Position });
                    table.CheckConstraint("fitment_years", " \"FromYear\" BETWEEN 1900 AND 2200 AND \"ToYear\" BETWEEN \"FromYear\" AND 2200 ");
                    table.ForeignKey(
                        name: "FK_product_fitments_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_product_fitments_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_part_references_BusinessId_Key",
                schema: "khypupyme",
                table: "part_references",
                columns: new[] { "BusinessId", "Key" });

            migrationBuilder.CreateIndex(
                name: "IX_product_fitments_BusinessId_BrandKey_ModelKey_FromYear_ToYe~",
                schema: "khypupyme",
                table: "product_fitments",
                columns: new[] { "BusinessId", "BrandKey", "ModelKey", "FromYear", "ToYear" });

            foreach (var table in new[] { "part_references", "product_fitments" })
            {
                migrationBuilder.Sql($"""
                    ALTER TABLE khypupyme.{table} ENABLE ROW LEVEL SECURITY;
                    CREATE POLICY commerce_business ON khypupyme.{table} USING (
                        "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                        AND EXISTS (SELECT 1 FROM khypupyme.businesses b WHERE b."Id" = "BusinessId")
                    );
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "part_references",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "product_fitments",
                schema: "khypupyme");

            migrationBuilder.DropColumn(
                name: "CountUnit",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DetailBrand",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DetailJson",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DetailModel",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "MeasureLabel",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PartsJson",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PrintingColor",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PrintingSize",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Reference",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "RollLength",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Shelf",
                schema: "khypupyme",
                table: "products");
        }
    }
}
