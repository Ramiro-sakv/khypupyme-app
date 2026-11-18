using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CommercialCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cash_sessions",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    OpeningMinor = table.Column<long>(type: "bigint", nullable: false),
                    ExpectedMinor = table.Column<long>(type: "bigint", nullable: false),
                    CountedMinor = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cash_sessions", x => new { x.BusinessId, x.Id });
                    table.CheckConstraint("cash_amounts", "\"OpeningMinor\" BETWEEN 0 AND 1000000000000 AND \"ExpectedMinor\" BETWEEN 0 AND 1000000000000\r\nAND (\"CountedMinor\" IS NULL OR \"CountedMinor\" BETWEEN 0 AND 1000000000000)");
                    table.ForeignKey(
                        name: "FK_cash_sessions_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "commerce_receipts",
                schema: "khypupyme",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    Digest = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commerce_receipts", x => new { x.AccountId, x.Id });
                    table.ForeignKey(
                        name: "FK_commerce_receipts_businesses_AccountId_BusinessId",
                        columns: x => new { x.AccountId, x.BusinessId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "customers",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customers", x => new { x.BusinessId, x.Id });
                    table.ForeignKey(
                        name: "FK_customers_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "products",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    NormalizedCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PriceMinor = table.Column<long>(type: "bigint", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    ValueMinor = table.Column<long>(type: "bigint", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => new { x.BusinessId, x.Id });
                    table.CheckConstraint("products_balance", "\"Stock\" BETWEEN 0 AND 1000000 AND \"ValueMinor\" BETWEEN 0 AND 1000000000000\r\nAND \"PriceMinor\" BETWEEN 0 AND 1000000000000 AND (\"Stock\" > 0 OR \"ValueMinor\" = 0)");
                    table.ForeignKey(
                        name: "FK_products_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "commerce_entries",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    CashSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    BusinessName = table.Column<string>(type: "text", nullable: false),
                    CustomerName = table.Column<string>(type: "text", nullable: true),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Method = table.Column<string>(type: "text", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: false),
                    TotalMinor = table.Column<long>(type: "bigint", nullable: false),
                    DiscountMinor = table.Column<long>(type: "bigint", nullable: false),
                    CashDeltaMinor = table.Column<long>(type: "bigint", nullable: false),
                    SalesMinor = table.Column<long>(type: "bigint", nullable: false),
                    CostMinor = table.Column<long>(type: "bigint", nullable: false),
                    PurchasesMinor = table.Column<long>(type: "bigint", nullable: false),
                    ExpensesMinor = table.Column<long>(type: "bigint", nullable: false),
                    LossesMinor = table.Column<long>(type: "bigint", nullable: false),
                    DebtDeltaMinor = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commerce_entries", x => new { x.BusinessId, x.Id });
                    table.ForeignKey(
                        name: "FK_commerce_entries_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_commerce_entries_cash_sessions_BusinessId_CashSessionId",
                        columns: x => new { x.BusinessId, x.CashSessionId },
                        principalSchema: "khypupyme",
                        principalTable: "cash_sessions",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_commerce_entries_commerce_entries_BusinessId_SourceId",
                        columns: x => new { x.BusinessId, x.SourceId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_commerce_entries_customers_BusinessId_CustomerId",
                        columns: x => new { x.BusinessId, x.CustomerId },
                        principalSchema: "khypupyme",
                        principalTable: "customers",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "commerce_lines",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitMinor = table.Column<long>(type: "bigint", nullable: false),
                    SubtotalMinor = table.Column<long>(type: "bigint", nullable: false),
                    CostMinor = table.Column<long>(type: "bigint", nullable: false),
                    Restocked = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commerce_lines", x => new { x.BusinessId, x.EntryId, x.ProductId });
                    table.CheckConstraint("commerce_lines_quantities", "\"Quantity\" BETWEEN 1 AND 1000000 AND \"UnitMinor\" >= 0 AND \"SubtotalMinor\" >= 0 AND \"CostMinor\" >= 0");
                    table.ForeignKey(
                        name: "FK_commerce_lines_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_commerce_lines_commerce_entries_BusinessId_EntryId",
                        columns: x => new { x.BusinessId, x.EntryId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_commerce_lines_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateTable(
                name: "receivables",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalMinor = table.Column<long>(type: "bigint", nullable: false),
                    BalanceMinor = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_receivables", x => new { x.BusinessId, x.SaleId });
                    table.CheckConstraint("receivables_balance", "\"OriginalMinor\" > 0 AND \"BalanceMinor\" BETWEEN 0 AND \"OriginalMinor\"");
                    table.ForeignKey(
                        name: "FK_receivables_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_receivables_commerce_entries_BusinessId_SaleId",
                        columns: x => new { x.BusinessId, x.SaleId },
                        principalSchema: "khypupyme",
                        principalTable: "commerce_entries",
                        principalColumns: new[] { "BusinessId", "Id" });
                    table.ForeignKey(
                        name: "FK_receivables_customers_BusinessId_CustomerId",
                        columns: x => new { x.BusinessId, x.CustomerId },
                        principalSchema: "khypupyme",
                        principalTable: "customers",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_cash_sessions_BusinessId",
                schema: "khypupyme",
                table: "cash_sessions",
                column: "BusinessId",
                unique: true,
                filter: "\"ClosedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_cash_sessions_BusinessId_OpenedAt_Id",
                schema: "khypupyme",
                table: "cash_sessions",
                columns: new[] { "BusinessId", "OpenedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_CashSessionId",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "CashSessionId" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_CustomerId",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_Date",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_Kind_Sequence",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "Kind", "Sequence" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_Kind_SourceId",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "Kind", "SourceId" },
                unique: true,
                filter: "\"Kind\" IN ('void-expense','sale','collect')");

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_Sequence",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_commerce_entries_BusinessId_SourceId",
                schema: "khypupyme",
                table: "commerce_entries",
                columns: new[] { "BusinessId", "SourceId" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_lines_BusinessId_ProductId",
                schema: "khypupyme",
                table: "commerce_lines",
                columns: new[] { "BusinessId", "ProductId" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_receipts_AccountId_BusinessId",
                schema: "khypupyme",
                table: "commerce_receipts",
                columns: new[] { "AccountId", "BusinessId" });

            migrationBuilder.CreateIndex(
                name: "IX_customers_BusinessId_Name_Id",
                schema: "khypupyme",
                table: "customers",
                columns: new[] { "BusinessId", "Name", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_Name_Id",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "Name", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_NormalizedCode",
                schema: "khypupyme",
                table: "products",
                columns: new[] { "BusinessId", "NormalizedCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_receivables_BusinessId_CustomerId",
                schema: "khypupyme",
                table: "receivables",
                columns: new[] { "BusinessId", "CustomerId" });

            foreach (var table in new[] { "products", "customers", "cash_sessions", "commerce_entries", "commerce_lines", "receivables" })
            {
                migrationBuilder.Sql($"""
                    ALTER TABLE khypupyme.{table} ENABLE ROW LEVEL SECURITY;
                    CREATE POLICY commerce_business ON khypupyme.{table} USING (
                        "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                        AND EXISTS (
                            SELECT FROM khypupyme.businesses AS b
                            WHERE b."Id" = "BusinessId"
                              AND b."OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                        )
                    );
                    """);
            }

            migrationBuilder.Sql("""
                ALTER TABLE khypupyme.commerce_receipts ENABLE ROW LEVEL SECURITY;
                CREATE POLICY commerce_receipt_account ON khypupyme.commerce_receipts USING (
                    "AccountId" = nullif(current_setting('app.account_id', true), '')::uuid
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "commerce_lines",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "commerce_receipts",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "receivables",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "products",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "commerce_entries",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "cash_sessions",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "customers",
                schema: "khypupyme");
        }
    }
}
