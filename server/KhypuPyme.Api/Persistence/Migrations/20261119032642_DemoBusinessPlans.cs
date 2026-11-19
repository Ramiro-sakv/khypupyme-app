using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DemoBusinessPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "account_trials",
                schema: "khypupyme",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstBusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_trials", x => x.OwnerId);
                    table.CheckConstraint("trial_window", " (\"StartedAt\" IS NULL AND \"EndsAt\" IS NULL) OR (\"StartedAt\" IS NOT NULL AND \"EndsAt\" IS NOT NULL AND \"EndsAt\" > \"StartedAt\") ");
                    table.ForeignKey(
                        name: "FK_account_trials_businesses_OwnerId_FirstBusinessId",
                        columns: x => new { x.OwnerId, x.FirstBusinessId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "demo_payments",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<string>(type: "text", nullable: false),
                    PlanName = table.Column<string>(type: "text", nullable: false),
                    AmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    Days = table.Column<int>(type: "integer", nullable: false),
                    Months = table.Column<int>(type: "integer", nullable: false),
                    CardId = table.Column<string>(type: "text", nullable: false),
                    CardBrand = table.Column<string>(type: "text", nullable: false),
                    CardLastFour = table.Column<string>(type: "text", nullable: false),
                    TestResult = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AccessFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AccessUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_demo_payments", x => new { x.BusinessId, x.Id });
                    table.CheckConstraint("demo_payment_period", "\"AmountMinor\" > 0 AND ((\"Days\" > 0 AND \"Months\" = 0) OR (\"Days\" = 0 AND \"Months\" > 0))\nAND ((\"State\" IN ('approved','refunded') AND \"PaidAt\" IS NOT NULL AND \"AccessFrom\" IS NOT NULL\n      AND \"AccessUntil\" IS NOT NULL AND \"AccessUntil\" > \"AccessFrom\")\n  OR (\"State\" NOT IN ('approved','refunded') AND \"PaidAt\" IS NULL AND \"AccessFrom\" IS NULL AND \"AccessUntil\" IS NULL))");
                    table.CheckConstraint("demo_payment_state", "\"State\" IN ('pending','approved','declined','cancelled','expired','refunded')\nAND \"TestResult\" IN ('approved','declined') AND \"CardLastFour\" ~ '^[0-9]{4}$'");
                    table.ForeignKey(
                        name: "FK_demo_payments_businesses_OwnerId_BusinessId",
                        columns: x => new { x.OwnerId, x.BusinessId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_account_trials_OwnerId_FirstBusinessId",
                schema: "khypupyme",
                table: "account_trials",
                columns: new[] { "OwnerId", "FirstBusinessId" });

            migrationBuilder.CreateIndex(
                name: "IX_demo_payments_BusinessId",
                schema: "khypupyme",
                table: "demo_payments",
                column: "BusinessId",
                unique: true,
                filter: " \"State\" = 'pending' ");

            migrationBuilder.CreateIndex(
                name: "IX_demo_payments_OwnerId_BusinessId_CreatedAt",
                schema: "khypupyme",
                table: "demo_payments",
                columns: new[] { "OwnerId", "BusinessId", "CreatedAt" });
            migrationBuilder.Sql("""
                INSERT INTO khypupyme.account_trials ("OwnerId", "FirstBusinessId")
                SELECT DISTINCT ON (b."OwnerId") b."OwnerId", b."Id"
                FROM khypupyme.businesses b
                LEFT JOIN LATERAL (
                    SELECT min(e."CreatedAt") AS started
                    FROM khypupyme.commerce_entries e WHERE e."BusinessId" = b."Id"
                ) first_entry ON true
                WHERE b."PracticeOriginId" IS NULL
                ORDER BY b."OwnerId", first_entry.started NULLS LAST, b."Id";

                ALTER TABLE khypupyme.account_trials ENABLE ROW LEVEL SECURITY;
                CREATE POLICY trial_owner ON khypupyme.account_trials USING (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                ) WITH CHECK (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND "FirstBusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                );
                ALTER TABLE khypupyme.demo_payments ENABLE ROW LEVEL SECURITY;
                CREATE POLICY demo_payment_owner ON khypupyme.demo_payments USING (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                ) WITH CHECK (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "account_trials",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "demo_payments",
                schema: "khypupyme");
        }
    }
}
