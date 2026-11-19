using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FourPrimaryIndustries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: "khypupyme",
                table: "customers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "business_code_counters",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    Prefix = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Last = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_code_counters", x => new { x.BusinessId, x.Prefix });
                    table.ForeignKey(
                        name: "FK_business_code_counters_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_customers_BusinessId_Code",
                schema: "khypupyme",
                table: "customers",
                columns: new[] { "BusinessId", "Code" },
                unique: true);

            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT c."BusinessId", c."Id", row_number() OVER (PARTITION BY c."BusinessId" ORDER BY c."Id") AS n
                    FROM khypupyme.customers c JOIN khypupyme.businesses b ON b."Id" = c."BusinessId"
                    WHERE b."Industry" IN ('timber','convenience','clothing','appliances')
                )
                UPDATE khypupyme.customers c
                SET "Code" = 'CLI-' || repeat('0', greatest(0, 6 - length(n.n::text))) || n.n::text
                FROM numbered n WHERE c."BusinessId" = n."BusinessId" AND c."Id" = n."Id";

                INSERT INTO khypupyme.business_code_counters ("BusinessId", "Prefix", "Last")
                SELECT "BusinessId", 'CLI', count(*) FROM khypupyme.customers WHERE "Code" IS NOT NULL GROUP BY "BusinessId";

                WITH profiles AS (
                    SELECT "Id", CASE "Industry" WHEN 'timber' THEN 'MAD' WHEN 'convenience' THEN 'TIE'
                        WHEN 'clothing' THEN 'ROP' WHEN 'appliances' THEN 'ELE' END AS prefix
                    FROM khypupyme.businesses WHERE "Industry" IN ('timber','convenience','clothing','appliances')
                )
                INSERT INTO khypupyme.business_code_counters ("BusinessId", "Prefix", "Last")
                SELECT p."BusinessId", b.prefix, max(substring(p."NormalizedCode" from 5)::bigint)
                FROM khypupyme.products p JOIN profiles b ON p."BusinessId" = b."Id"
                WHERE p."NormalizedCode" ~ ('^' || b.prefix || '-[0-9]{6,12}$')
                GROUP BY p."BusinessId", b.prefix;

                ALTER TABLE khypupyme.business_code_counters ENABLE ROW LEVEL SECURITY;
                CREATE POLICY commerce_business ON khypupyme.business_code_counters
                    USING ("BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "business_code_counters",
                schema: "khypupyme");

            migrationBuilder.DropIndex(
                name: "IX_customers_BusinessId_Code",
                schema: "khypupyme",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: "khypupyme",
                table: "customers");
        }
    }
}
