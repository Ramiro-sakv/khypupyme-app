using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TimberAndPractice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_commerce_lines",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.AddColumn<long>(
                name: "LongMinor",
                schema: "khypupyme",
                table: "products",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ShortMinor",
                schema: "khypupyme",
                table: "products",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Species",
                schema: "khypupyme",
                table: "products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SuperShortMinor",
                schema: "khypupyme",
                table: "products",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LineId",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<long>(
                name: "LengthMicros",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OriginalLineId",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Species",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ThicknessMicros",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "WidthMicros",
                schema: "khypupyme",
                table: "commerce_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Practice",
                schema: "khypupyme",
                table: "commerce_entries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TimberUnits",
                schema: "khypupyme",
                table: "commerce_entries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PracticeOriginId",
                schema: "khypupyme",
                table: "businesses",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""UPDATE khypupyme.commerce_lines SET "LineId" = "ProductId";""");

            migrationBuilder.AddPrimaryKey(
                name: "PK_commerce_lines",
                schema: "khypupyme",
                table: "commerce_lines",
                columns: new[] { "BusinessId", "EntryId", "LineId" });

            migrationBuilder.CreateTable(
                name: "timber_practices",
                schema: "khypupyme",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginId = table.Column<Guid>(type: "uuid", nullable: false),
                    SandboxId = table.Column<Guid>(type: "uuid", nullable: true),
                    Step = table.Column<int>(type: "integer", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_timber_practices", x => new { x.OwnerId, x.OriginId });
                    table.ForeignKey(
                        name: "FK_timber_practices_businesses_OwnerId_OriginId",
                        columns: x => new { x.OwnerId, x.OriginId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "timber_stock",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    LengthMicros = table.Column<long>(type: "bigint", nullable: false),
                    ThicknessMicros = table.Column<long>(type: "bigint", nullable: false),
                    WidthMicros = table.Column<long>(type: "bigint", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    ValueMinor = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_timber_stock", x => new { x.BusinessId, x.ProductId, x.LengthMicros, x.ThicknessMicros, x.WidthMicros });
                    table.CheckConstraint("timber_stock_amounts", "\"Stock\" BETWEEN 0 AND 1000000 AND \"ValueMinor\" BETWEEN 0 AND 1000000000000\r\nAND (\"Stock\" > 0 OR \"ValueMinor\" = 0)\r\nAND \"LengthMicros\" BETWEEN 304800000 AND 6096000000 AND \"LengthMicros\" % 304800000 = 0\r\nAND \"ThicknessMicros\" BETWEEN 1 AND 10000000000 AND \"WidthMicros\" BETWEEN 1 AND 10000000000");
                    table.ForeignKey(
                        name: "FK_timber_stock_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_timber_stock_products_BusinessId_ProductId",
                        columns: x => new { x.BusinessId, x.ProductId },
                        principalSchema: "khypupyme",
                        principalTable: "products",
                        principalColumns: new[] { "BusinessId", "Id" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_businesses_OwnerId_PracticeOriginId",
                schema: "khypupyme",
                table: "businesses",
                columns: new[] { "OwnerId", "PracticeOriginId" });

            migrationBuilder.CreateIndex(
                name: "IX_timber_practices_SandboxId",
                schema: "khypupyme",
                table: "timber_practices",
                column: "SandboxId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_businesses_businesses_OwnerId_PracticeOriginId",
                schema: "khypupyme",
                table: "businesses",
                columns: new[] { "OwnerId", "PracticeOriginId" },
                principalSchema: "khypupyme",
                principalTable: "businesses",
                principalColumns: new[] { "OwnerId", "Id" });

            migrationBuilder.Sql("""
                ALTER TABLE khypupyme.timber_stock ENABLE ROW LEVEL SECURITY;
                CREATE POLICY timber_stock_scope ON khypupyme.timber_stock USING (
                    "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                    AND EXISTS (SELECT 1 FROM khypupyme.businesses b WHERE b."Id" = "BusinessId")
                );
                ALTER TABLE khypupyme.timber_practices ENABLE ROW LEVEL SECURITY;
                CREATE POLICY timber_practice_scope ON khypupyme.timber_practices USING (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND nullif(current_setting('app.business_id', true), '')::uuid IN ("OriginId", "SandboxId")
                );
                CREATE POLICY timber_practice_remove ON khypupyme.businesses FOR DELETE USING (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND "Id" = nullif(current_setting('app.business_id', true), '')::uuid
                    AND "PracticeOriginId" = nullif(current_setting('app.practice_origin', true), '')::uuid
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP POLICY timber_practice_remove ON khypupyme.businesses;");

            migrationBuilder.DropForeignKey(
                name: "FK_businesses_businesses_OwnerId_PracticeOriginId",
                schema: "khypupyme",
                table: "businesses");

            migrationBuilder.DropTable(
                name: "timber_practices",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "timber_stock",
                schema: "khypupyme");

            migrationBuilder.DropPrimaryKey(
                name: "PK_commerce_lines",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropIndex(
                name: "IX_businesses_OwnerId_PracticeOriginId",
                schema: "khypupyme",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "LongMinor",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ShortMinor",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Species",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "SuperShortMinor",
                schema: "khypupyme",
                table: "products");

            migrationBuilder.DropColumn(
                name: "LineId",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "LengthMicros",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "OriginalLineId",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "Species",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "ThicknessMicros",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "WidthMicros",
                schema: "khypupyme",
                table: "commerce_lines");

            migrationBuilder.DropColumn(
                name: "Practice",
                schema: "khypupyme",
                table: "commerce_entries");

            migrationBuilder.DropColumn(
                name: "TimberUnits",
                schema: "khypupyme",
                table: "commerce_entries");

            migrationBuilder.DropColumn(
                name: "PracticeOriginId",
                schema: "khypupyme",
                table: "businesses");

            migrationBuilder.AddPrimaryKey(
                name: "PK_commerce_lines",
                schema: "khypupyme",
                table: "commerce_lines",
                columns: new[] { "BusinessId", "EntryId", "ProductId" });
        }
    }
}
