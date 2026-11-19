using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServiceWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsService",
                schema: "khypupyme",
                table: "products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "work_items",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Industry = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    StartMinute = table.Column<int>(type: "integer", nullable: true),
                    Duration = table.Column<int>(type: "integer", nullable: true),
                    BudgetMinor = table.Column<long>(type: "bigint", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    DetailsJson = table.Column<string>(type: "jsonb", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReceiptId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeliveredOn = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_items", x => new { x.BusinessId, x.Id });
                    table.CheckConstraint("work_item_schedule", "\"Revision\" > 0 AND\r\n((\"Industry\" = 'beauty' AND \"ServiceId\" IS NOT NULL AND \"StartMinute\" IS NOT NULL AND \"Duration\" IS NOT NULL\r\n    AND \"StartMinute\" BETWEEN 0 AND 1439 AND \"Duration\" BETWEEN 5 AND 720 AND \"StartMinute\" + \"Duration\" <= 1440)\r\n OR (\"Industry\" IN ('cleaning','professional','repair','crafts') AND \"StartMinute\" IS NULL AND \"Duration\" IS NULL))");
                    table.ForeignKey(
                        name: "FK_work_items_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_work_items_commerce_entries_BusinessId_ReceiptId",
                        columns: x => new { x.BusinessId, x.ReceiptId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_work_items_commerce_entries_BusinessId_SaleId",
                        columns: x => new { x.BusinessId, x.SaleId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_work_items_customers_BusinessId_CustomerId",
                        columns: x => new { x.BusinessId, x.CustomerId },
                        principalSchema: "khypupyme",
                        principalTable: "customers",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_work_items_products_BusinessId_ServiceId",
                        columns: x => new { x.BusinessId, x.ServiceId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_BusinessId_CustomerId",
                schema: "khypupyme",
                table: "work_items",
                columns: new[] { "BusinessId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_BusinessId_Day_StartMinute_Id",
                schema: "khypupyme",
                table: "work_items",
                columns: new[] { "BusinessId", "Day", "StartMinute", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_BusinessId_ReceiptId",
                schema: "khypupyme",
                table: "work_items",
                columns: new[] { "BusinessId", "ReceiptId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_items_BusinessId_SaleId",
                schema: "khypupyme",
                table: "work_items",
                columns: new[] { "BusinessId", "SaleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_items_BusinessId_ServiceId",
                schema: "khypupyme",
                table: "work_items",
                columns: new[] { "BusinessId", "ServiceId" });
            migrationBuilder.Sql("""
                ALTER TABLE khypupyme.work_items ENABLE ROW LEVEL SECURITY;
                CREATE POLICY commerce_business ON khypupyme.work_items USING (
                    "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                    AND EXISTS (SELECT 1 FROM khypupyme.businesses b WHERE b."Id" = "BusinessId")
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "work_items",
                schema: "khypupyme");

            migrationBuilder.DropColumn(
                name: "IsService",
                schema: "khypupyme",
                table: "products");
        }
    }
}
