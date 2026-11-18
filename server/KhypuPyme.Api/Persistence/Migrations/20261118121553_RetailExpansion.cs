using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetailExpansion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Held",
                schema: "khypupyme",
                table: "retail_lots",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Brand",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Presentation",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tone",
                schema: "khypupyme",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "container_types",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Available = table.Column<int>(type: "integer", nullable: false),
                    Borrowed = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_container_types", x => new { x.BusinessId, x.Id });
                    table.CheckConstraint("container_type_quantities", " \"Available\" >= 0 AND \"Borrowed\" >= 0 AND \"Available\" + \"Borrowed\" <= 1000000 ");
                    table.ForeignKey(
                        name: "FK_container_types_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "container_balances",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    TypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_container_balances", x => new { x.BusinessId, x.TypeId, x.CustomerId });
                    table.CheckConstraint("container_balance_quantity", " \"Quantity\" BETWEEN 0 AND 1000000 ");
                    table.ForeignKey(
                        name: "FK_container_balances_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_container_balances_container_types_BusinessId_TypeId",
                        columns: x => new { x.BusinessId, x.TypeId },
                        principalSchema: "khypupyme",
                        principalTable: "container_types",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_container_balances_customers_BusinessId_CustomerId",
                        columns: x => new { x.BusinessId, x.CustomerId },
                        principalSchema: "khypupyme",
                        principalTable: "customers",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "container_movements",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Delivered = table.Column<int>(type: "integer", nullable: false),
                    Returned = table.Column<int>(type: "integer", nullable: false),
                    Added = table.Column<int>(type: "integer", nullable: false),
                    CustomerBalance = table.Column<int>(type: "integer", nullable: true),
                    Available = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_container_movements", x => new { x.BusinessId, x.EntryId, x.TypeId });
                    table.ForeignKey(
                        name: "FK_container_movements_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_container_movements_commerce_entries_BusinessId_EntryId",
                        columns: x => new { x.BusinessId, x.EntryId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_container_movements_container_types_BusinessId_TypeId",
                        columns: x => new { x.BusinessId, x.TypeId },
                        principalSchema: "khypupyme",
                        principalTable: "container_types",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_container_balances_BusinessId_CustomerId",
                schema: "khypupyme",
                table: "container_balances",
                columns: new[] { "BusinessId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_container_movements_BusinessId_TypeId",
                schema: "khypupyme",
                table: "container_movements",
                columns: new[] { "BusinessId", "TypeId" });

            migrationBuilder.CreateIndex(
                name: "IX_container_types_BusinessId_Key",
                schema: "khypupyme",
                table: "container_types",
                columns: new[] { "BusinessId", "Key" },
                unique: true);

            foreach (var table in new[] { "container_types", "container_balances", "container_movements" })
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
                name: "container_balances",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "container_movements",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "container_types",
                schema: "khypupyme");

            migrationBuilder.DropColumn(
                name: "Held",
                schema: "khypupyme",
                table: "retail_lots");

            migrationBuilder.DropColumn(
                name: "Brand",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Presentation",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Tone",
                schema: "khypupyme",
                table: "products");
        }
    }
}
