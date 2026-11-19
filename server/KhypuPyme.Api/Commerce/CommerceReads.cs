using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class CommerceReads(KhypuPymeDbContext db, TimeProvider clock, StoreReads store)
{
    private const int PageSize = 20;
    private IQueryable<Entry> Entries => db.Set<Entry>().AsNoTracking();

    public Task<SetupStatus> SetupAsync(Guid businessId, CancellationToken ct) => db.Businesses.Where(b => b.Id == businessId)
        .Select(b => new SetupStatus(
            db.Set<CashSession>().Any(x => x.BusinessId == b.Id),
            db.Set<Product>().Any(x => x.BusinessId == b.Id && x.Active),
            Entries.Any(x => x.BusinessId == b.Id && x.Kind == "sale")))
        .SingleAsync(ct);

    public Task<CommercePage<ProductInfo>> ProductsAsync(string? search, bool? active, string? attention,
        string? vehicleBrand, string? vehicleModel, int? year, bool? service, int? page, CancellationToken ct)
    {
        var query = db.Set<Product>().AsNoTracking();
        if (active is not null) query = query.Where(x => x.Active == active);
        if (service is not null) query = query.Where(x => x.IsService == service);
        if (attention is not null) query = store.AttentionProducts(query.Where(x => x.Active), attention);
        query = store.FilterCompatibility(query, vehicleBrand, vehicleModel, year);
        query = store.SearchProducts(query, search);
        return PageAsync(store.Describe(query.OrderBy(x => x.Name).ThenBy(x => x.Id)), page, ct);
    }

    public Task<ProductInfo?> ProductAsync(Guid id, CancellationToken ct) =>
        store.Describe(db.Set<Product>().AsNoTracking().Where(x => x.Id == id)).SingleOrDefaultAsync(ct);

    public async Task<ProductInfo[]> ProductBatchAsync(Guid businessId, string ids, CancellationToken ct)
    {
        if (ids.Length > 3699) throw new CommerceFailure("Consulta hasta 100 productos.");
        var keys = new HashSet<Guid>();
        foreach (var value in ids.Split(','))
        {
            if (!Guid.TryParseExact(value, "D", out var id) || id == Guid.Empty)
                throw new CommerceFailure("Indica identificadores de producto válidos.");
            keys.Add(id);
        }
        var products = await store.Describe(db.Set<Product>().AsNoTracking().Where(x => x.BusinessId == businessId && keys.Contains(x.Id)))
            .ToArrayAsync(ct);
        if (products.Length != keys.Count) throw new CommerceFailure("Un producto no está disponible en este negocio.", 404);
        return products;
    }

    public Task<CommercePage<TimberStockInfo>> TimberStockAsync(Guid productId, long? length, long? thickness, long? width,
        string? widths, string? category, int? page, CancellationToken ct)
    {
        var query = db.Set<TimberStock>().AsNoTracking().Where(x => x.ProductId == productId && x.Stock > 0);
        (int Min, int Max) range = category switch
        {
            null or "" => (1, 20), "super-short" => (1, 2), "short" => (3, 6), "long" => (7, 20),
            _ => throw new CommerceFailure("Elige una categoría de largo válida.")
        };
        if (category is not null and not "")
            query = query.Where(x => x.LengthMicros >= range.Min * TimberMeasures.Foot && x.LengthMicros <= range.Max * TimberMeasures.Foot);
        if (length is not null) query = query.Where(x => x.LengthMicros == length);
        if (thickness is not null) query = query.Where(x => x.ThicknessMicros == thickness);
        if (width is not null) query = query.Where(x => x.WidthMicros == width);
        if (widths is not null)
        {
            var parts = widths.Length <= 1200 ? widths.Split(',') : [];
            if (parts.Length is < 1 or > 100 || parts.Any(x => !long.TryParse(x, out var size) || size is <= 0 or > 10_000_000_000))
                throw new CommerceFailure("Indica de 1 a 100 anchos válidos.");
            var selected = parts.Select(long.Parse).ToArray();
            query = query.Where(x => selected.Contains(x.WidthMicros));
        }
        var ordered = query.OrderBy(x => x.LengthMicros).ThenBy(x => x.ThicknessMicros).ThenBy(x => x.WidthMicros)
            .Select(x => new TimberStockInfo(new TimberDimensions(x.LengthMicros, x.ThicknessMicros, x.WidthMicros), x.Stock, x.ValueMinor));
        return PageAsync(ordered, page, ct, 100);
    }

    public Task<CommercePage<CustomerInfo>> CustomersAsync(string? search, int? page, CancellationToken ct)
    {
        var query = db.Set<Customer>().AsNoTracking();
        var term = Search(search);
        if (term is not null)
            query = query.Where(x => EF.Functions.ILike(x.Name, term, "\\") || EF.Functions.ILike(x.Phone, term, "\\") || (x.Code != null && EF.Functions.ILike(x.Code, term, "\\")));
        return PageAsync(query.OrderBy(x => x.Name).ThenBy(x => x.Id).Select(x => new CustomerInfo(x.Id, x.Name, x.Phone, x.Code)), page, ct);
    }

    public Task<CustomerInfo?> CustomerAsync(Guid id, CancellationToken ct) =>
        db.Set<Customer>().AsNoTracking().Where(x => x.Id == id).Select(x => new CustomerInfo(x.Id, x.Name, x.Phone, x.Code))
            .SingleOrDefaultAsync(ct);

    public Task<CommercePage<EntryInfo>> HistoryAsync(string? kind, Guid? cashSession, DateOnly? from, DateOnly? to,
        string? search, int? page, CancellationToken ct)
    {
        if (from > to) throw new CommerceFailure("La fecha inicial debe ser anterior o igual a la final.");
        var term = Search(search);
        var query = Entries;
        if (kind == "expenses") query = query.Where(x => x.Kind == "expense" || x.Kind == "void-expense");
        else if (kind == "sales") query = query.Where(x => x.Kind == "sale" || x.Kind == "return" || x.Kind == "exchange");
        else if (kind == "documents") query = query.Where(x => x.Kind == "sale" || x.Kind == "purchase" || x.Kind == "quote" ||
            x.Kind == "return" || x.Kind == "exchange" || x.Kind == "collect" || x.Kind == "close-cash" || x.Kind == "repair-receipt" ||
            x.Kind == "cash-adjust" || x.Kind == "stock-in" || x.Kind == "manual-debt" || x.Kind == "void-debt" ||
            x.Kind == "warranty" || x.Kind == "prepare-delivery" || x.Kind == "cancel-delivery" ||
            x.Kind == "delivery-receipt" || x.Kind == "work-receipt");
        else if (!string.IsNullOrEmpty(kind)) query = query.Where(x => x.Kind == kind);
        if (cashSession is not null) query = query.Where(x => x.CashSessionId == cashSession);
        if (from is DateOnly start) query = query.Where(x => x.Date >= start);
        if (to is DateOnly end) query = query.Where(x => x.Date <= end);
        if (term is not null) query = query.Where(x => EF.Functions.ILike(x.Number, term, "\\") ||
            x.CustomerName != null && EF.Functions.ILike(x.CustomerName, term, "\\") || EF.Functions.ILike(x.Note, term, "\\"));
        return PageAsync(query.OrderByDescending(x => x.Sequence).Select(x => new EntryInfo(x.Id, x.Number, x.Kind, x.Date,
            x.Method, x.CustomerName, x.TotalMinor, x.CashDeltaMinor, x.SourceId,
            Entries.Any(next => next.SourceId == x.Id && (next.Kind == "sale" || next.Kind == "void-expense")))), page, ct);
    }

    public async Task<EntryDocument?> DocumentAsync(Guid id, CancellationToken ct)
    {
        var entry = await Entries.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entry is null) return null;

        var linked = await Entries.AnyAsync(next => next.SourceId == id && (next.Kind == "sale" || next.Kind == "void-expense"), ct);
        var returned = entry.Kind is "sale" or "exchange"
            ? await Entries.Where(x => (x.Kind == "return" || x.Kind == "exchange") && x.SourceId == id)
                .SelectMany(x => x.Lines.Where(line => x.Kind == "return" || line.OriginalLineId != null))
                .GroupBy(x => x.OriginalLineId ?? x.ProductId)
                .ToDictionaryAsync(group => group.Key, group => group.Sum(x => x.BaseQuantity ?? x.Quantity), ct)
            : [];
        var lines = entry.Lines.OrderBy(x => x.Name).ThenBy(x => x.ProductId).ThenBy(x => x.LengthMicros).ThenBy(x => x.ThicknessMicros)
            .ThenBy(x => x.WidthMicros).Select(x => new DocumentLine(
            x.ProductId, x.Name, x.Code, x.Quantity, x.UnitMinor, x.SubtotalMinor, x.CostMinor,
            x.Restocked, x.BaseQuantity is null ? (int)returned.GetValueOrDefault(x.LineId) : 0, x.LineId, x.Species, x.Timber,
            LineDetails.Parse(x.DetailsJson), returned.GetValueOrDefault(x.LineId))).ToArray();

        var balance = entry.Kind is "manual-debt" || entry.Kind == "sale" && entry.Method == "credit"
            ? await db.Set<Receivable>().Where(x => x.SaleId == id).Select(x => x.BalanceMinor).SingleOrDefaultAsync(ct) : 0;
        var containers = await db.Set<ContainerMovement>().AsNoTracking().Where(x => x.EntryId == id).OrderBy(x => x.Name)
            .Select(x => new ContainerMovementInfo(x.Name, x.Delivered, x.Returned, x.CustomerBalance, x.Available, x.Added)).ToArrayAsync(ct);
        var delivery = entry.Kind == "sale" ? await FurnitureDeliveries.Query(db, id).SingleOrDefaultAsync(ct) : null;
        var work = entry.Kind == "sale" ? await WorkQueries.ChargeAsync(db, id, ct) : null;
        return new EntryDocument(entry.Id, entry.Number, entry.Kind, entry.Date, entry.ExpiresOn, entry.BusinessName,
            entry.CustomerId, entry.CustomerName, entry.Method, entry.Note, entry.TotalMinor, entry.DiscountMinor, entry.CashDeltaMinor,
            entry.DebtDeltaMinor, entry.SourceId, linked, lines, entry.TimberUnits, entry.Practice, balance, containers, delivery, work);
    }

    public async Task<CashStatus> CashAsync(CancellationToken ct) => new(await CashSessions().FirstOrDefaultAsync(ct));

    public Task<CommercePage<CashInfo>> CashSessionsAsync(int? page, CancellationToken ct) =>
        PageAsync(CashSessions(), page, ct);

    private IQueryable<CashInfo> CashSessions() =>
        db.Set<CashSession>().AsNoTracking().OrderByDescending(x => x.ClosedAt == null)
            .ThenByDescending(x => x.OpenedAt).ThenByDescending(x => x.Id)
            .Select(x => new CashInfo(x.Id, x.OpenedAt, x.ClosedAt, x.OpeningMinor, x.ExpectedMinor, x.CountedMinor));

    public Task<CommercePage<ReceivableInfo>> DebtsAsync(bool? paid, int? page, CancellationToken ct)
    {
        var query = from debt in db.Set<Receivable>().AsNoTracking()
                    join sale in Entries on new { debt.BusinessId, Id = debt.SaleId } equals new { sale.BusinessId, sale.Id }
                    where paid != true ? debt.BalanceMinor > 0 : debt.BalanceMinor == 0
                    orderby sale.Sequence descending
                    select new ReceivableInfo(sale.Id, sale.Number, sale.Date, sale.CustomerName!, debt.OriginalMinor, debt.BalanceMinor,
                        sale.Kind == "manual-debt", Entries.Any(x => x.Kind == "void-debt" && x.SourceId == sale.Id));
        return PageAsync(query, page, ct);
    }

    public async Task<CommerceReport> ReportAsync(Guid businessId, DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var today = LocalDate(clock.GetUtcNow());
        var end = to ?? today;
        var start = from ?? end.AddDays(-Math.Min(6, end.DayNumber));
        if (start > end || end > today || end.DayNumber - start.DayNumber > 365)
            throw new CommerceFailure("El periodo debe tener hasta 366 días y terminar como máximo hoy.");

        var grouped = await Entries.Where(x => x.BusinessId == businessId && x.Date >= start && x.Date <= end &&
                (x.Kind == "sale" || x.Kind == "return" || x.Kind == "purchase" ||
                    x.Kind == "expense" || x.Kind == "void-expense" || x.Kind == "stock-loss" ||
                    x.Kind == "discard-lot" || x.Kind == "exchange" || x.Kind == "inspection"))
            .GroupBy(x => x.Date).Select(rows => new ResultDay(rows.Key, rows.Sum(x => x.SalesMinor),
                rows.Sum(x => x.CostMinor), rows.Sum(x => x.PurchasesMinor), rows.Sum(x => x.ExpensesMinor), rows.Sum(x => x.LossesMinor)))
            .ToDictionaryAsync(x => x.Date, ct);

        var days = Enumerable.Range(0, end.DayNumber - start.DayNumber + 1)
            .Select(start.AddDays).Select(day => grouped.GetValueOrDefault(day) ?? new ResultDay(day, 0, 0, 0, 0, 0)).ToArray();
        var totals = new ResultDay(end, days.Sum(x => x.SalesMinor), days.Sum(x => x.CostMinor),
            days.Sum(x => x.PurchasesMinor), days.Sum(x => x.ExpensesMinor), days.Sum(x => x.LossesMinor));
        var balances = await db.Businesses.Where(b => b.Id == businessId).Select(b => new
        {
            Stock = db.Set<Product>().Where(x => x.BusinessId == b.Id).Sum(x => x.ValueMinor) +
                db.Set<EquipmentUnit>().Where(x => x.BusinessId == b.Id && x.State == "inspection").Sum(x => x.CostMinor),
            Debts = db.Set<Receivable>().Where(x => x.BusinessId == b.Id).Sum(x => x.BalanceMinor),
        }).SingleAsync(ct);
        return new CommerceReport(start, end, totals, days, balances.Stock, balances.Debts);
    }

    internal static string? Search(string? input)
    {
        var value = Text(input, 80, "la búsqueda");
        return value.Length == 0 ? null : "%" + value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
    }

    internal static async Task<CommercePage<T>> PageAsync<T>(IQueryable<T> query, int? page, CancellationToken ct, int size = PageSize)
    {
        var number = page ?? 1;
        if (number is < 1 or > 10000) throw new CommerceFailure("Selecciona una página válida.");
        var items = await query.Skip((number - 1) * size).Take(size + 1).ToArrayAsync(ct);
        return new CommercePage<T>(items.Take(size).ToArray(), items.Length > size);
    }
}
