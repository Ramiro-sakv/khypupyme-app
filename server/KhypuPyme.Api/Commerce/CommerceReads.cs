using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class CommerceReads(KhypuPymeDbContext db, TimeProvider clock)
{
    private const int PageSize = 20;
    private IQueryable<Entry> Entries => db.Set<Entry>().AsNoTracking();

    public Task<CommercePage<ProductInfo>> ProductsAsync(string? search, bool? active, int? page, CancellationToken ct)
    {
        var query = db.Set<Product>().AsNoTracking();
        if (active is not null) query = query.Where(x => x.Active == active);
        var term = Search(search);
        if (term is not null)
            query = query.Where(x => EF.Functions.ILike(x.Name, term, "\\") || EF.Functions.ILike(x.Code, term, "\\"));
        return PageAsync(query.OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Select(x => new ProductInfo(x.Id, x.Name, x.Code, x.PriceMinor, x.Stock, x.ValueMinor, x.Active)), page, ct);
    }

    public Task<ProductInfo?> ProductAsync(Guid id, CancellationToken ct) =>
        db.Set<Product>().AsNoTracking().Where(x => x.Id == id)
            .Select(x => new ProductInfo(x.Id, x.Name, x.Code, x.PriceMinor, x.Stock, x.ValueMinor, x.Active))
            .SingleOrDefaultAsync(ct);

    public Task<CommercePage<CustomerInfo>> CustomersAsync(string? search, int? page, CancellationToken ct)
    {
        var query = db.Set<Customer>().AsNoTracking();
        var term = Search(search);
        if (term is not null)
            query = query.Where(x => EF.Functions.ILike(x.Name, term, "\\") || EF.Functions.ILike(x.Phone, term, "\\"));
        return PageAsync(query.OrderBy(x => x.Name).ThenBy(x => x.Id).Select(x => new CustomerInfo(x.Id, x.Name, x.Phone)), page, ct);
    }

    public Task<CustomerInfo?> CustomerAsync(Guid id, CancellationToken ct) =>
        db.Set<Customer>().AsNoTracking().Where(x => x.Id == id).Select(x => new CustomerInfo(x.Id, x.Name, x.Phone))
            .SingleOrDefaultAsync(ct);

    public Task<CommercePage<EntryInfo>> HistoryAsync(string? kind, Guid? cashSession, int? page, CancellationToken ct)
    {
        var query = Entries;
        if (kind == "expenses") query = query.Where(x => x.Kind == "expense" || x.Kind == "void-expense");
        else if (!string.IsNullOrEmpty(kind)) query = query.Where(x => x.Kind == kind);
        if (cashSession is not null) query = query.Where(x => x.CashSessionId == cashSession);
        return PageAsync(query.OrderByDescending(x => x.Sequence).Select(x => new EntryInfo(x.Id, x.Number, x.Kind, x.Date,
            x.Method, x.CustomerName, x.TotalMinor, x.CashDeltaMinor, x.SourceId,
            Entries.Any(next => next.SourceId == x.Id && (next.Kind == "sale" || next.Kind == "void-expense")))), page, ct);
    }

    public async Task<EntryDocument?> DocumentAsync(Guid id, CancellationToken ct)
    {
        var entry = await Entries.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entry is null) return null;

        var linked = await Entries.AnyAsync(next => next.SourceId == id && (next.Kind == "sale" || next.Kind == "void-expense"), ct);
        var returned = entry.Kind == "sale"
            ? await Entries.Where(x => x.Kind == "return" && x.SourceId == id).SelectMany(x => x.Lines)
                .GroupBy(x => x.ProductId).ToDictionaryAsync(group => group.Key, group => group.Sum(x => x.Quantity), ct)
            : [];
        var lines = entry.Lines.OrderBy(x => x.Name).ThenBy(x => x.ProductId).Select(x => new DocumentLine(
            x.ProductId, x.Name, x.Code, x.Quantity, x.UnitMinor, x.SubtotalMinor, x.CostMinor,
            x.Restocked, returned.GetValueOrDefault(x.ProductId))).ToArray();

        return new EntryDocument(entry.Id, entry.Number, entry.Kind, entry.Date, entry.ExpiresOn, entry.BusinessName,
            entry.CustomerId, entry.CustomerName, entry.Method, entry.Note, entry.TotalMinor, entry.DiscountMinor, entry.CashDeltaMinor,
            entry.DebtDeltaMinor, entry.SourceId, linked, lines);
    }

    public async Task<CashStatus> CashAsync(CancellationToken ct) =>
        new(await db.Set<CashSession>().AsNoTracking().OrderByDescending(x => x.ClosedAt == null)
            .ThenByDescending(x => x.OpenedAt).ThenByDescending(x => x.Id)
            .Select(x => new CashInfo(x.Id, x.OpenedAt, x.ClosedAt, x.OpeningMinor, x.ExpectedMinor, x.CountedMinor))
            .FirstOrDefaultAsync(ct));

    public Task<CommercePage<ReceivableInfo>> DebtsAsync(bool? paid, int? page, CancellationToken ct)
    {
        var query = from debt in db.Set<Receivable>().AsNoTracking()
                    join sale in Entries on new { debt.BusinessId, Id = debt.SaleId } equals new { sale.BusinessId, sale.Id }
                    where paid != true ? debt.BalanceMinor > 0 : debt.BalanceMinor == 0
                    orderby sale.Sequence descending
                    select new ReceivableInfo(sale.Id, sale.Number, sale.Date, sale.CustomerName!, debt.OriginalMinor, debt.BalanceMinor);
        return PageAsync(query, page, ct);
    }

    public async Task<CommerceReport> ReportAsync(DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var today = LocalDate(clock.GetUtcNow());
        var end = to ?? today;
        var start = from ?? end.AddDays(-Math.Min(6, end.DayNumber));
        if (start > end || end > today || end.DayNumber - start.DayNumber > 365)
            throw new CommerceFailure("El periodo debe tener hasta 366 días y terminar como máximo hoy.");

        var grouped = await Entries.Where(x => x.Date >= start && x.Date <= end &&
                (x.Kind == "sale" || x.Kind == "return" || x.Kind == "purchase" ||
                    x.Kind == "expense" || x.Kind == "void-expense" || x.Kind == "stock-loss"))
            .GroupBy(x => x.Date).Select(rows => new ResultDay(rows.Key, rows.Sum(x => x.SalesMinor),
                rows.Sum(x => x.CostMinor), rows.Sum(x => x.PurchasesMinor), rows.Sum(x => x.ExpensesMinor), rows.Sum(x => x.LossesMinor)))
            .ToDictionaryAsync(x => x.Date, ct);

        var days = Enumerable.Range(0, end.DayNumber - start.DayNumber + 1)
            .Select(start.AddDays).Select(day => grouped.GetValueOrDefault(day) ?? new ResultDay(day, 0, 0, 0, 0, 0)).ToArray();
        var totals = new ResultDay(end, days.Sum(x => x.SalesMinor), days.Sum(x => x.CostMinor),
            days.Sum(x => x.PurchasesMinor), days.Sum(x => x.ExpensesMinor), days.Sum(x => x.LossesMinor));
        var stock = await db.Set<Product>().SumAsync(x => x.ValueMinor, ct);
        var debts = await db.Set<Receivable>().SumAsync(x => x.BalanceMinor, ct);
        return new CommerceReport(start, end, totals, days, stock, debts);
    }

    private static string? Search(string? input)
    {
        var value = Text(input, 80, "la búsqueda");
        return value.Length == 0 ? null : "%" + value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
    }

    private static async Task<CommercePage<T>> PageAsync<T>(IQueryable<T> query, int? page, CancellationToken ct)
    {
        var number = page ?? 1;
        if (number is < 1 or > 10000) throw new CommerceFailure("Selecciona una página válida.");
        var items = await query.Skip((number - 1) * PageSize).Take(PageSize + 1).ToArrayAsync(ct);
        return new CommercePage<T>(items.Take(PageSize).ToArray(), items.Length > PageSize);
    }
}
