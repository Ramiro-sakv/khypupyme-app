using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Billing;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Persistence;

public sealed class KhypuPymeDbContext(DbContextOptions<KhypuPymeDbContext> options)
    : IdentityUserContext<IdentityUser<Guid>, Guid>(options)
{
    public const string Schema = "khypupyme";
    public DbSet<EmailChallenge> EmailChallenges => Set<EmailChallenge>();
    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<BusinessSettings> BusinessSettings => Set<BusinessSettings>();
    public DbSet<AccountSelection> AccountSelections => Set<AccountSelection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.UseOpenIddict<Guid>();
        CommerceModel.Configure(modelBuilder);
        BillingModel.Configure(modelBuilder);
        SecurityModel.Configure(modelBuilder);
        modelBuilder.Entity<IdentityUser<Guid>>().HasIndex(user => user.NormalizedEmail).IsUnique();

        modelBuilder.Entity<EmailChallenge>(entry =>
        {
            entry.ToTable("email_challenges");
            entry.HasKey(x => new { x.Email, x.Purpose });
            entry.Property(x => x.Email).HasMaxLength(256);
            entry.Property(x => x.Purpose).HasMaxLength(16);
        });

        modelBuilder.Entity<Business>(entry =>
        {
            entry.ToTable("businesses");
            entry.HasKey(x => x.Id);
            entry.HasAlternateKey(x => new { x.OwnerId, x.Id });
            entry.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
                .HasForeignKey(x => new { x.OwnerId, x.PracticeOriginId }).OnDelete(DeleteBehavior.NoAction);
            entry.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(x => x.OwnerId);
            entry.Property(x => x.Name).HasMaxLength(100);
            entry.Property(x => x.Industry).HasMaxLength(32);
            entry.Property(x => x.CreationDigest).HasMaxLength(64);
            entry.HasIndex(x => new { x.OwnerId, x.Name, x.Id });
        });

        modelBuilder.Entity<TimberPractice>(entry =>
        {
            entry.ToTable("timber_practices");
            entry.HasKey(x => new { x.OwnerId, x.OriginId });
            entry.HasIndex(x => x.SandboxId).IsUnique();
            entry.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
                .HasForeignKey(x => new { x.OwnerId, x.OriginId });
        });

        modelBuilder.Entity<BusinessSettings>(entry =>
        {
            entry.ToTable("business_settings", table =>
            {
                table.HasCheckConstraint("business_settings_payment", "\"DefaultPayment\" IN ('cash', 'qr', 'transfer')");
                table.HasCheckConstraint("business_settings_discount", "\"MaxDiscountPercent\" BETWEEN 0 AND 100");
                table.HasCheckConstraint("business_settings_days", "\"QuoteDays\" BETWEEN 1 AND 90 AND \"LotAlertDays\" BETWEEN 1 AND 90");
                table.HasCheckConstraint("business_settings_revision", "\"PolicyRevision\" >= 0");
            });
            entry.HasKey(x => x.BusinessId);
            entry.HasOne<Business>().WithOne().HasPrincipalKey<Business>(x => new { x.OwnerId, x.Id })
                .HasForeignKey<BusinessSettings>(x => new { x.OwnerId, x.BusinessId });
            entry.Property(x => x.City).HasMaxLength(80);
            entry.Property(x => x.Phone).HasMaxLength(32);
            entry.Property(x => x.TimberUnits).HasMaxLength(10);
            entry.Property(x => x.DefaultPayment).HasMaxLength(10).HasDefaultValue(BusinessPolicy.DefaultPayment);
            entry.Property(x => x.MaxDiscountPercent).HasDefaultValue(BusinessPolicy.MaxDiscountPercent).HasSentinel(-1);
            entry.Property(x => x.QuoteDays).HasDefaultValue(BusinessPolicy.QuoteDays);
            entry.Property(x => x.AllowNewCredit).HasDefaultValue(true);
            entry.Property(x => x.LotAlertDays).HasDefaultValue(BusinessPolicy.LotAlertDays);
            entry.Property(x => x.PolicyRevision).HasDefaultValue(0);
        });

        modelBuilder.Entity<AccountSelection>(entry =>
        {
            entry.ToTable("account_selections");
            entry.HasKey(x => x.OwnerId);
            entry.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
                .HasForeignKey(x => new { x.OwnerId, x.BusinessId });
        });
    }
}
