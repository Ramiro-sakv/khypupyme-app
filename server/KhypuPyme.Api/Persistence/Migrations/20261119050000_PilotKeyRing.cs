using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace KhypuPyme.Api.Persistence.Migrations;

[DbContext(typeof(KhypuPymeDbContext))]
[Migration("20261119050000_PilotKeyRing")]
public sealed class PilotKeyRing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("CREATE TABLE khypupyme.pilot_key_ring (name text PRIMARY KEY, payload text NOT NULL);");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("DROP TABLE khypupyme.pilot_key_ring;");
}
