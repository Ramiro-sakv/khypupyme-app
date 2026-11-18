using Microsoft.EntityFrameworkCore.Migrations;

namespace KhypuPyme.Api.Persistence.Migrations;

public partial class InitialSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema("khypupyme");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP SCHEMA khypupyme RESTRICT;");
    }
}
