using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Persistence;

public sealed class KhypuPymeDbContext(DbContextOptions<KhypuPymeDbContext> options) : DbContext(options)
{
    public const string Schema = "khypupyme";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
    }
}
