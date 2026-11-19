using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KhypuPyme.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProtectedCorrectionsAndRemoval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_account_trials_businesses_OwnerId_FirstBusinessId",
                schema: "khypupyme",
                table: "account_trials");

            migrationBuilder.DropIndex(
                name: "IX_account_trials_OwnerId_FirstBusinessId",
                schema: "khypupyme",
                table: "account_trials");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AcknowledgedAt",
                schema: "khypupyme",
                table: "commerce_receipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "account_closures",
                schema: "khypupyme",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_closures", x => x.OwnerId);
                    table.ForeignKey(
                        name: "FK_account_closures_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "khypupyme",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "business_deletions",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    SandboxId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: true),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_deletions", x => x.BusinessId);
                    table.ForeignKey(
                        name: "FK_business_deletions_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "khypupyme",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "commerce_audit",
                schema: "khypupyme",
                columns: table => new
                {
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    OperationId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Effect = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commerce_audit", x => new { x.BusinessId, x.OperationId });
                    table.ForeignKey(
                        name: "FK_commerce_audit_businesses_AccountId_BusinessId",
                        columns: x => new { x.AccountId, x.BusinessId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "security_mail_limits",
                schema: "khypupyme",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    SentAt = table.Column<DateTimeOffset[]>(type: "timestamp with time zone[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_security_mail_limits", x => x.OwnerId);
                    table.ForeignKey(
                        name: "FK_security_mail_limits_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "khypupyme",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "security_proofs",
                schema: "khypupyme",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: true),
                    Purpose = table.Column<string>(type: "text", nullable: false),
                    Binding = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    Stage = table.Column<string>(type: "text", nullable: false),
                    ProtectedCode = table.Column<string>(type: "text", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_security_proofs", x => new { x.OwnerId, x.Id });
                    table.ForeignKey(
                        name: "FK_security_proofs_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "khypupyme",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_security_proofs_businesses_OwnerId_BusinessId",
                        columns: x => new { x.OwnerId, x.BusinessId },
                        principalSchema: "khypupyme",
                        principalTable: "businesses",
                        principalColumns: new[] { "OwnerId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_business_deletions_OwnerId_CompletedAt",
                schema: "khypupyme",
                table: "business_deletions",
                columns: new[] { "OwnerId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_audit_AccountId_BusinessId",
                schema: "khypupyme",
                table: "commerce_audit",
                columns: new[] { "AccountId", "BusinessId" });

            migrationBuilder.CreateIndex(
                name: "IX_commerce_audit_BusinessId_At",
                schema: "khypupyme",
                table: "commerce_audit",
                columns: new[] { "BusinessId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_security_proofs_OwnerId_BusinessId",
                schema: "khypupyme",
                table: "security_proofs",
                columns: new[] { "OwnerId", "BusinessId" });

            migrationBuilder.AddForeignKey(
                name: "FK_account_trials_AspNetUsers_OwnerId",
                schema: "khypupyme",
                table: "account_trials",
                column: "OwnerId",
                principalSchema: "khypupyme",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
            migrationBuilder.Sql("""
                UPDATE khypupyme.commerce_receipts SET "AcknowledgedAt" = now();
                """);
            foreach (var table in new[] { "security_proofs", "security_mail_limits", "business_deletions", "account_closures" })
                migrationBuilder.Sql($"""
                    ALTER TABLE khypupyme.{table} ENABLE ROW LEVEL SECURITY;
                    CREATE POLICY account_private ON khypupyme.{table} USING (
                        "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    );
                    """);
            migrationBuilder.Sql("""
                ALTER TABLE khypupyme.commerce_audit ENABLE ROW LEVEL SECURITY;
                CREATE POLICY audit_scope ON khypupyme.commerce_audit USING (
                    "AccountId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND "BusinessId" = nullif(current_setting('app.business_id', true), '')::uuid
                );
                CREATE POLICY business_confirmed_removal ON khypupyme.businesses FOR DELETE USING (
                    "OwnerId" = nullif(current_setting('app.account_id', true), '')::uuid
                    AND EXISTS (
                        SELECT 1 FROM khypupyme.business_deletions job
                        WHERE job."OwnerId" = businesses."OwnerId" AND job."CompletedAt" IS NULL
                            AND job."BusinessId" = nullif(current_setting('app.delete_business', true), '')::uuid
                            AND (businesses."Id" = job."BusinessId" AND businesses."PracticeOriginId" IS NULL
                                OR businesses."Id" = job."SandboxId" AND businesses."PracticeOriginId" = job."BusinessId")
                    )
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP POLICY business_confirmed_removal ON khypupyme.businesses;");
            migrationBuilder.DropForeignKey(
                name: "FK_account_trials_AspNetUsers_OwnerId",
                schema: "khypupyme",
                table: "account_trials");

            migrationBuilder.DropTable(
                name: "account_closures",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "business_deletions",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "commerce_audit",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "security_mail_limits",
                schema: "khypupyme");

            migrationBuilder.DropTable(
                name: "security_proofs",
                schema: "khypupyme");

            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                schema: "khypupyme",
                table: "commerce_receipts");

            migrationBuilder.CreateIndex(
                name: "IX_account_trials_OwnerId_FirstBusinessId",
                schema: "khypupyme",
                table: "account_trials",
                columns: new[] { "OwnerId", "FirstBusinessId" });

            migrationBuilder.AddForeignKey(
                name: "FK_account_trials_businesses_OwnerId_FirstBusinessId",
                schema: "khypupyme",
                table: "account_trials",
                columns: new[] { "OwnerId", "FirstBusinessId" },
                principalSchema: "khypupyme",
                principalTable: "businesses",
                principalColumns: new[] { "OwnerId", "Id" },
                onDelete: ReferentialAction.Cascade);
        }
    }
}
