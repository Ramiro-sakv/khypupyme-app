using KhypuPyme.Api.Businesses;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KhypuPyme.Api.Security;

internal static class SecurityModel
{
    public static void Configure(ModelBuilder model)
    {
        var proof = Owned<SecurityProof>(model, "security_proofs", x => x.OwnerId);
        proof.HasKey(x => new { x.OwnerId, x.Id });
        proof.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
            .HasForeignKey(x => new { x.OwnerId, Id = x.BusinessId }).OnDelete(DeleteBehavior.Cascade);
        Owned<SecurityMailLimit>(model, "security_mail_limits", x => x.OwnerId).HasKey(x => x.OwnerId);
        Owned<AccountClosure>(model, "account_closures", x => x.OwnerId).HasKey(x => x.OwnerId);
        var deletions = Owned<BusinessDeletion>(model, "business_deletions", x => x.OwnerId);
        deletions.HasKey(x => x.BusinessId);
        deletions.HasIndex(x => new { x.OwnerId, x.CompletedAt });

        var audit = model.Entity<CommerceAudit>();
        audit.ToTable("commerce_audit");
        audit.HasKey(x => new { x.BusinessId, x.OperationId });
        audit.HasIndex(x => new { x.BusinessId, x.At });
        audit.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
            .HasForeignKey(x => new { OwnerId = x.AccountId, Id = x.BusinessId });
        audit.Property(x => x.Effect).HasColumnType("jsonb");
    }

    private static EntityTypeBuilder<T> Owned<T>(ModelBuilder model, string table,
        System.Linq.Expressions.Expression<Func<T, object?>> foreignKey) where T : class
    {
        var entity = model.Entity<T>();
        entity.ToTable(table);
        entity.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(foreignKey);
        return entity;
    }
}
