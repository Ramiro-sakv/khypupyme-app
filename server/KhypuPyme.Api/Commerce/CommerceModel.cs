using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
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
        products.Property(x => x.Species).HasMaxLength(100);
        products.Property(x => x.MeasureStock).HasPrecision(20, 8);
        products.Property(x => x.Reorder).HasPrecision(20, 8);
        products.Property(x => x.RollLength).HasPrecision(12, 3);
        products.Property(x => x.DetailJson).HasColumnType("jsonb");
        products.Property(x => x.PartsJson).HasColumnType("jsonb");
        products.Property(x => x.MaterialJson).HasColumnType("jsonb");
        products.HasIndex(x => new { x.BusinessId, x.CementSourceId }).IsUnique();
        products.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.CementSourceId }).OnDelete(DeleteBehavior.NoAction);
        products.HasIndex(x => new { x.BusinessId, x.VariantKey }).IsUnique();
        products.HasIndex(x => new { x.BusinessId, x.ModelKey });
        products.ToTable(table => table.HasCheckConstraint("products_after_opening_months",
            """ "AfterOpeningMonths" IS NULL OR ("Brand" IS NOT NULL AND "AfterOpeningMonths" BETWEEN 1 AND 120) """));
        products.ToTable(table => table.HasCheckConstraint("products_balance",
            """
            "Stock" BETWEEN 0 AND 1000000 AND "ValueMinor" BETWEEN 0 AND 1000000000000
            AND "PriceMinor" BETWEEN 0 AND 1000000000000 AND ("Stock" > 0 OR "MeasureStock" > 0 OR "ValueMinor" = 0)
            AND "MeasureStock" BETWEEN 0 AND 1000000000
            AND ("RetailUnit" IS NOT NULL OR "MeasureStock" = 0)
            """));

        var customers = BusinessTable<Customer>(model, "customers");
        customers.HasKey(x => new { x.BusinessId, x.Id });
        customers.HasIndex(x => new { x.BusinessId, x.Name, x.Id });
        customers.Property(x => x.Name).HasMaxLength(100);
        customers.Property(x => x.Phone).HasMaxLength(32);
        customers.Property(x => x.Code).HasMaxLength(32);
        customers.HasIndex(x => new { x.BusinessId, x.Code }).IsUnique();

        var codes = BusinessTable<BusinessCodeCounter>(model, "business_code_counters");
        codes.HasKey(x => new { x.BusinessId, x.Prefix });
        codes.Property(x => x.Prefix).HasMaxLength(3);

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
        lines.HasKey(x => new { x.BusinessId, x.EntryId, x.LineId });
        lines.Property(x => x.LineId).ValueGeneratedNever();
        lines.Property(x => x.BaseQuantity).HasPrecision(20, 8);
        lines.Property(x => x.DetailsJson).HasColumnType("jsonb");
        lines.HasOne<Entry>().WithMany(x => x.Lines).HasForeignKey(x => new { x.BusinessId, x.EntryId }).OnDelete(DeleteBehavior.NoAction);
        lines.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        lines.ToTable(table => table.HasCheckConstraint("commerce_lines_quantities",
            """
            "Quantity" BETWEEN 1 AND 1000000 AND "UnitMinor" >= 0 AND "SubtotalMinor" >= 0 AND "CostMinor" >= 0
            """));

        var timber = BusinessTable<TimberStock>(model, "timber_stock");
        timber.HasKey(x => new { x.BusinessId, x.ProductId, x.LengthMicros, x.ThicknessMicros, x.WidthMicros });
        timber.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        timber.ToTable(table => table.HasCheckConstraint("timber_stock_amounts",
            """
            "Stock" BETWEEN 0 AND 1000000 AND "ValueMinor" BETWEEN 0 AND 1000000000000
            AND ("Stock" > 0 OR "ValueMinor" = 0)
            AND "LengthMicros" BETWEEN 304800000 AND 6096000000 AND "LengthMicros" % 304800000 = 0
            AND "ThicknessMicros" BETWEEN 1 AND 10000000000 AND "WidthMicros" BETWEEN 1 AND 10000000000
            """));

        var lots = BusinessTable<RetailLot>(model, "retail_lots");
        lots.HasKey(x => new { x.BusinessId, x.ProductId, x.Lot });
        lots.HasIndex(x => new { x.BusinessId, x.ProductId, x.ExpiresOn });
        lots.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        lots.Property(x => x.Quantity).HasPrecision(20, 8);
        lots.ToTable(table => table.HasCheckConstraint("retail_lot_balance",
            """ "Quantity" BETWEEN 0 AND 1000000000 AND "ValueMinor" BETWEEN 0 AND 1000000000000 AND ("Quantity" > 0 OR "ValueMinor" = 0) """));

        var units = BusinessTable<EquipmentUnit>(model, "equipment_units");
        units.HasKey(x => new { x.BusinessId, x.Key });
        units.HasIndex(x => new { x.BusinessId, x.ProductId, x.State });
        units.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        units.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, x.SaleId }).OnDelete(DeleteBehavior.NoAction);
        units.ToTable(table => table.HasCheckConstraint("equipment_unit_state",
            """ "State" IN ('available','sold','inspection','discarded') AND "CostMinor" BETWEEN 0 AND 1000000000000 """));

        var equipment = BusinessTable<EquipmentMovement>(model, "equipment_movements");
        equipment.HasKey(x => new { x.BusinessId, x.SerialKey, x.EntryId });
        equipment.HasOne<EquipmentUnit>().WithMany().HasForeignKey(x => new { x.BusinessId, Key = x.SerialKey }).OnDelete(DeleteBehavior.NoAction);
        equipment.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, x.EntryId }).OnDelete(DeleteBehavior.NoAction);

        var references = BusinessTable<PartReference>(model, "part_references");
        references.HasKey(x => new { x.BusinessId, x.ProductId, x.Key });
        references.HasIndex(x => new { x.BusinessId, x.Key });
        references.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);

        var fitments = BusinessTable<ProductFitment>(model, "product_fitments");
        fitments.HasKey(x => new { x.BusinessId, x.ProductId, x.Position });
        fitments.HasIndex(x => new { x.BusinessId, x.BrandKey, x.ModelKey, x.FromYear, x.ToYear });
        fitments.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, x.ProductId }).OnDelete(DeleteBehavior.NoAction);
        fitments.ToTable(table => table.HasCheckConstraint("fitment_years",
            """ "FromYear" BETWEEN 1900 AND 2200 AND "ToYear" BETWEEN "FromYear" AND 2200 """));

        var deliveries = BusinessTable<FurnitureDelivery>(model, "furniture_deliveries");
        deliveries.HasKey(x => new { x.BusinessId, x.SaleId });
        deliveries.HasIndex(x => new { x.BusinessId, x.Day });
        deliveries.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.SaleId }).OnDelete(DeleteBehavior.NoAction);
        deliveries.ToTable(table => table.HasCheckConstraint("furniture_delivery_mode",
            """ "Mode" IN ('pickup','delivery') AND ("Mode" = 'pickup' OR "Address" IS NOT NULL) """));

        var work = BusinessTable<WorkItem>(model, "work_items");
        work.HasKey(x => new { x.BusinessId, x.Id });
        work.HasIndex(x => new { x.BusinessId, x.Day, x.StartMinute, x.Id });
        work.HasIndex(x => new { x.BusinessId, x.SaleId }).IsUnique();
        work.HasIndex(x => new { x.BusinessId, x.ReceiptId }).IsUnique();
        work.Property(x => x.DetailsJson).HasColumnType("jsonb");
        work.HasOne<Customer>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.CustomerId }).OnDelete(DeleteBehavior.NoAction);
        work.HasOne<Product>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.ServiceId }).OnDelete(DeleteBehavior.NoAction);
        work.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.SaleId }).OnDelete(DeleteBehavior.NoAction);
        work.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.ReceiptId }).OnDelete(DeleteBehavior.NoAction);
        work.ToTable(table => table.HasCheckConstraint("work_item_schedule", """
            "Revision" > 0 AND
            (("Industry" = 'beauty' AND "ServiceId" IS NOT NULL AND "StartMinute" IS NOT NULL AND "Duration" IS NOT NULL
                AND "StartMinute" BETWEEN 0 AND 1439 AND "Duration" BETWEEN 5 AND 720 AND "StartMinute" + "Duration" <= 1440)
             OR ("Industry" IN ('cleaning','professional','repair','crafts') AND "StartMinute" IS NULL AND "Duration" IS NULL))
            """));

        var containers = BusinessTable<ContainerType>(model, "container_types");
        containers.HasKey(x => new { x.BusinessId, x.Id });
        containers.HasIndex(x => new { x.BusinessId, x.Key }).IsUnique();
        containers.ToTable(table => table.HasCheckConstraint("container_type_quantities",
            """ "Available" >= 0 AND "Borrowed" >= 0 AND "Available" + "Borrowed" <= 1000000 """));

        var balances = BusinessTable<ContainerBalance>(model, "container_balances");
        balances.HasKey(x => new { x.BusinessId, x.TypeId, x.CustomerId });
        balances.HasOne<ContainerType>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.TypeId }).OnDelete(DeleteBehavior.NoAction);
        balances.HasOne<Customer>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.CustomerId }).OnDelete(DeleteBehavior.NoAction);
        balances.ToTable(table => table.HasCheckConstraint("container_balance_quantity", """ "Quantity" BETWEEN 0 AND 1000000 """));

        var containerMovements = BusinessTable<ContainerMovement>(model, "container_movements");
        containerMovements.HasKey(x => new { x.BusinessId, x.EntryId, x.TypeId });
        containerMovements.HasOne<ContainerType>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.TypeId }).OnDelete(DeleteBehavior.NoAction);
        containerMovements.HasOne<Entry>().WithMany().HasForeignKey(x => new { x.BusinessId, Id = x.EntryId }).OnDelete(DeleteBehavior.NoAction);

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
