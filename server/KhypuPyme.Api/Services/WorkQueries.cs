using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Services;

internal static class WorkQueries
{
    private static IQueryable<WorkItem> Items(KhypuPymeDbContext db) => db.Set<WorkItem>().AsNoTracking();

    private static IQueryable<WorkItem> Active(IQueryable<WorkItem> rows) =>
        rows.Where(x => x.State != "delivered" && x.State != "attended" && x.State != "no-show" && x.State != "cancelled");

    private static IQueryable<WorkItem> Billable(IQueryable<WorkItem> rows) =>
        rows.Where(x => x.SaleId == null && (x.State == "ready" || x.State == "attended" || x.State == "delivered"));

    public static async Task<CommercePage<WorkInfo>> ListAsync(KhypuPymeDbContext db, DateOnly? day, string? filter, string? search,
        DateOnly today, int? page, CancellationToken ct)
    {
        var rows = Items(db);
        if (day is not null) rows = rows.Where(x => x.Day == day);
        rows = filter switch
        {
            null or "" => rows,
            "overdue" => Active(rows).Where(x => x.Day < today),
            "today" => Active(rows).Where(x => x.Day == today),
            "upcoming" => Active(rows).Where(x => x.Day > today && x.Day <= today.AddDays(7)),
            "waiting-parts" => rows.Where(x => x.State == "waiting-parts"),
            "cancelled" => rows.Where(x => x.State == "cancelled"),
            "billable" => Billable(rows),
            _ => throw new CommerceFailure("El filtro de la agenda u órdenes no es válido."),
        };
        var query = Project(db, rows);
        var term = CommerceReads.Search(search);
        if (term is not null)
            query = query.Where(x => EF.Functions.ILike(x.Item.Title, term, "\\") ||
                EF.Functions.ILike(x.CustomerName, term, "\\") ||
                x.Item.Address != null && EF.Functions.ILike(x.Item.Address, term, "\\"));
        var pageResult = await CommerceReads.PageAsync(query, page, ct);
        return new(pageResult.Items.Select(ProjectInfo).ToArray(), pageResult.HasMore);
    }

    public static async Task<WorkInfo?> FindAsync(KhypuPymeDbContext db, Guid id, CancellationToken ct)
    {
        var record = await Project(db, Items(db).Where(x => x.Id == id)).SingleOrDefaultAsync(ct);
        return record is null ? null : ProjectInfo(record);
    }

    public static Task<WorkCharge?> ChargeAsync(KhypuPymeDbContext db, Guid sale, CancellationToken ct) =>
        Items(db).Where(x => x.SaleId == sale).Select(x => new WorkCharge(x.Id, x.Title)).SingleOrDefaultAsync(ct);

    public static async Task<WorkAttention> AttentionAsync(KhypuPymeDbContext db, DateOnly today, CancellationToken ct)
    {
        var rows = Items(db);
        var active = Active(rows);
        var pending = await active.GroupBy(_ => 1).Select(group => new
        {
            Today = group.Count(x => x.Day == today),
            Overdue = group.Count(x => x.Day < today),
            Upcoming = group.Count(x => x.Day > today && x.Day <= today.AddDays(7)),
            WaitingParts = group.Count(x => x.State == "waiting-parts"),
        }).SingleOrDefaultAsync(ct);
        return new(pending?.Today ?? 0, pending?.Overdue ?? 0, await Billable(rows).CountAsync(ct),
            pending?.Upcoming ?? 0, pending?.WaitingParts ?? 0);
    }

    private sealed class WithCustomer
    {
        public required WorkItem Item { get; init; }
        public required string CustomerName { get; init; }
    }

    private static IQueryable<WithCustomer> Project(KhypuPymeDbContext db, IQueryable<WorkItem> rows) =>
        from row in rows
        join customer in db.Set<Customer>().AsNoTracking() on new { row.BusinessId, Id = row.CustomerId } equals new { customer.BusinessId, customer.Id }
        orderby row.Day, row.StartMinute, row.Id
        select new WithCustomer { Item = row, CustomerName = customer.Name };

    private static WorkInfo ProjectInfo(WithCustomer data)
    {
        var row = data.Item;
        return new(row.Id, row.Title, row.Industry, row.CustomerId, data.CustomerName, row.ServiceId, row.Day, row.StartMinute,
            row.Duration, row.BudgetMinor, row.Address, WorkDetails.Read(row.DetailsJson), row.State, row.Revision, row.SaleId, row.ReceiptId, row.DeliveredOn);
    }
}
