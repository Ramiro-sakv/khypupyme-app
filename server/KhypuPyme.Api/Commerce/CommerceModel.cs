using KhypuPyme.Api.Businesses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KhypuPyme.Api.Commerce;

internal static class CommerceModel
{
    public static void Configure(ModelBuilder model)
    {
        var products = BusinessTable<Product>(model, "products");
        products.HasKey(x => new { x.BusinessId, x.Id });
        products.HasIndex(x => new { x.BusinessId, x.NormalizedCode }).IsUnique();
        products.HasIndex(x => new { x.BusinessId, x.Name, x.Id });
        products.Property(x => x.Name).HasMaxLength(100);
        products.Property(x => x.Code).HasMaxLength(40);
        products.Property(x => x.NormalizedCode).HasMaxLength(40);
        products.ToTable(table => table.HasCheckConstraint("products_balance",
            """
            "Stock" BETWEEN 0 AND 1000000 AND "ValueMinor" BETWEEN 0 AND 1000000000000
            AND "PriceMinor" BETWEEN 0 AND 1000000000000 AND ("Stock" > 0 OR "ValueMinor" = 0)
            """));

        var customers = BusinessTable<Customer>(model, "customers");
        customers.HasKey(x => new { x.BusinessId, x.Id });
        customers.HasIndex(x => new { x.BusinessId, x.Name, x.Id });
        customers.Property(x => x.Name).HasMaxLength(100);
        customers.Property(x => x.Phone).HasMaxLength(32);

        var cash = BusinessTable<CashSession>(model, "cash_sessions");
        cash.HasKey(x => new { x.BusinessId, x.Id });
        cash.HasIndex(x => x.BusinessId).HasFilter("""
            "ClosedAt" IS NULL
            """).IsUnique();
        cash.HasIndex(x => new { x.BusinessId, x.OpenedAt, x.Id });
        cash.ToTable(table => table.HasCheckConstraint("cash_amounts",
            """
            "OpeningMinor" BETWEEN 0 AND 1000000000000 AND "ExpectedMinor" BETWEEN 0 AND 1000000000000
            AND ("CountedMinor" IS NULL OR "CountedMinor" BETWEEN 0 AND 1000000000000)
            """));

        var entries = BusinessTable<Entry>(model, "commerce_entries");
        entries.HasKey(x => new { x.BusinessId, x.Id });
        entries.HasIndex(x => new { x.BusinessId, x.Sequence }).IsUnique();
        entries.HasIndex(x => new { x.BusinessId, x.Date });
        entries.HasIndex(x => new { x.BusinessId, x.Kind, x.Sequence });
        entries.HasIndex(x => new { x.BusinessId, x.Kind, x.SourceId }).IsUnique().HasFilter("""
            "Kind" IN ('void-expense','sale','collect')
            """);
        entries.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, x.SourceId }).OnDelete(DeleteBehavior.NoAction);
        entries.HasOne<CashSession>().WithMany().HasForeignKey(x => new { x.BusinessId, x.CashSessionId }).OnDelete(DeleteBehavior.NoAction);
        entries.HasOne<Customer>().WithMany().HasForeignKey(x => new { x.BusinessId, x.CustomerId }).OnDelete(DeleteBehavior.NoAction);

        var lines = BusinessTable<EntryLine>(model, "commerce_lines");
        lines.HasKey(x => new { x.BusinessId, x.EntryId, x.ProductId });
        lines.HasOne<Entry>().WithMany(x => x.Lines).HasForeignKey(x => new { x.BusinessId, x.EntryId }).OnDelete(DeleteBehavior.NoAction);
        lines.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        lines.ToTable(table => table.HasCheckConstraint("commerce_lines_quantities",
            """
            "Quantity" BETWEEN 1 AND 1000000 AND "UnitMinor" >= 0 AND "SubtotalMinor" >= 0 AND "CostMinor" >= 0
            """));

        var debts = BusinessTable<Receivable>(model, "receivables");
        debts.HasKey(x => new { x.BusinessId, x.SaleId });
        debts.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, x.SaleId }).OnDelete(DeleteBehavior.NoAction);
        debts.HasOne<Customer>().WithMany().HasForeignKey(x => new { x.BusinessId, x.CustomerId }).OnDelete(DeleteBehavior.NoAction);
        debts.ToTable(table => table.HasCheckConstraint("receivables_balance",
            """
            "OriginalMinor" > 0 AND "BalanceMinor" BETWEEN 0 AND "OriginalMinor"
            """));

        var receipts = model.Entity<CommerceReceipt>();
        receipts.ToTable("commerce_receipts");
        receipts.HasKey(x => new { x.AccountId, x.Id });
        receipts.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id })
            .HasForeignKey(x => new { x.AccountId, x.BusinessId });
    }

    private static EntityTypeBuilder<T> BusinessTable<T>(ModelBuilder model, string table) where T : class, IBusinessRecord
    {
        var entity = model.Entity<T>();
        entity.ToTable(table);
        entity.HasOne<Business>().WithMany().HasForeignKey(x => x.BusinessId);
        return entity;
    }
}
