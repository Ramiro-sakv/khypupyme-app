using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StoreWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "products_balance",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.AddColumn<int>(
                name: "BoxSize",
                schema: "khypupyme",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Color",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MeasureStock",
                schema: "khypupyme",
                table: "products",
                type: "numeric(20,8)",
                precision: 20,
                scale: 8,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModelKey",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Reorder",
                schema: "khypupyme",
                table: "products",
                type: "numeric(20,8)",
                precision: 20,
                scale: 8,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "RetailUnit",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Size",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TrackLots",
                schema: "khypupyme",
                table: "products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "VariantKey",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarrantyMonths",
                schema: "khypupyme",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BaseQuantity",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "numeric(20,8)",
                precision: 20,
                scale: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetailsJson",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "equipment_units",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "text", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Serial = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    CostMinor = table.Column<long>(type: "bigint", nullable: false),
                    WarrantyUntil = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_equipment_units", x => new { x.BusinessId, x.Key });
                    table.CheckConstraint("equipment_unit_state", " \"State\" IN ('available','sold','inspection','discarded') AND \"CostMinor\" BETWEEN 0 AND 1000000000000 ");
                    table.ForeignKey(
                        name: "FK_equipment_units_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_equipment_units_commerce_entries_BusinessId_SaleId",
                        columns: x => new { x.BusinessId, x.SaleId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_equipment_units_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "retail_lots",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Lot = table.Column<string>(type: "text", nullable: false),
                    ExpiresOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(20,8)", precision: 20, scale: 8, nullable: false),
                    ValueMinor = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_retail_lots", x => new { x.BusinessId, x.ProductId, x.Lot });
                    table.CheckConstraint("retail_lot_balance", " \"Quantity\" BETWEEN 0 AND 1000000000 AND \"ValueMinor\" BETWEEN 0 AND 1000000000000 AND (\"Quantity\" > 0 OR \"ValueMinor\" = 0) ");
                    table.ForeignKey(
                        name: "FK_retail_lots_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_retail_lots_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "equipment_movements",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    SerialKey = table.Column<string>(type: "text", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    WarrantyUntil = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_equipment_movements", x => new { x.BusinessId, x.SerialKey, x.EntryId });
                    table.ForeignKey(
                        name: "FK_equipment_movements_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_equipment_movements_commerce_entries_BusinessId_EntryId",
                        columns: x => new { x.BusinessId, x.EntryId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_equipment_movements_equipment_units_BusinessId_SerialKey",
                        columns: x => new { x.BusinessId, x.SerialKey },
                        principalSchema: "khypupyme",
                        principalTable: "equipment_units",
                        principalColumns: new[] { "BusinessId", "Key" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_ModelKey",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "ModelKey" });

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_VariantKey",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "VariantKey" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "products_balance",
                schema: "khypupyme",
                table: "products",
                sql: "\"Stock\" BETWEEN 0 AND 1000000 AND \"ValueMinor\" BETWEEN 0 AND 1000000000000\r\nAND \"PriceMinor\" BETWEEN 0 AND 1000000000000 AND (\"Stock\" > 0 OR \"MeasureStock\" > 0 OR \"ValueMinor\" = 0)\r\nAND \"MeasureStock\" BETWEEN 0 AND 1000000000\r\nAND (\"RetailUnit\" IS NOT NULL OR \"MeasureStock\" = 0)");

            migrationBuilder.CreateIndex(
                name: "IX_equipment_movements_BusinessId_EntryId",
                schema: "khypupyme",
                table: "equipment_movements",
                columns: new[] { "BusinessId", "EntryId" });

            migrationBuilder.CreateIndex(
                name: "IX_equipment_units_BusinessId_ProductId_State",
                schema: "khypupyme",
                table: "equipment_units",
                columns: new[] { "BusinessId", "ProductId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_equipment_units_BusinessId_SaleId",
                schema: "khypupyme",
                table: "equipment_units",
                columns: new[] { "BusinessId", "SaleId" });

            migrationBuilder.CreateIndex(
                name: "IX_retail_lots_BusinessId_ProductId_ExpiresOn",
                schema: "khypupyme",
                table: "retail_lots",
                columns: new[] { "BusinessId", "ProductId", "ExpiresOn" });

            foreach (var table in new[] { "retail_lots", "equipment_units", "equipment_movements" })
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
                name: "equipment_movements",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "retail_lots",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "equipment_units",
                schema: "khypupyme");

            migrationBuilder.DropIndex(
                name: "IX_products_BusinessId_ModelKey",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_BusinessId_VariantKey",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropCheckConstraint(
                name: "products_balance",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "BoxSize",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Color",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "MeasureStock",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Model",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ModelKey",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Reorder",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "RetailUnit",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Size",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "TrackLots",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "VariantKey",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "WarrantyMonths",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "BaseQuantity",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "DetailsJson",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.AddCheckConstraint(
                name: "products_balance",
                schema: "khypupyme",
                table: "products",
                sql: "\"Stock\" BETWEEN 0 AND 1000000 AND \"ValueMinor\" BETWEEN 0 AND 1000000000000\r\nAND \"PriceMinor\" BETWEEN 0 AND 1000000000000 AND (\"Stock\" > 0 OR \"ValueMinor\" = 0)");
        }
    }
}
