using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Services;

internal static class WorkQueries
{
    private static IQueryable<WorkItem> Items(KhypuPymeDbContext db) => db.Set<WorkItem>().AsNoTracking();

    public static async Task<CommercePage<WorkInfo>> ListAsync(KhypuPymeDbContext db, DateOnly? day, string? filter,
        DateOnly today, int? page, CancellationToken ct)
    {
        var rows = Items(db);
        if (day is not null) rows = rows.Where(x => x.Day == day);
        rows = filter switch
        {
            null or "" => rows,
            "overdue" => rows.Where(x => x.Day < today && x.State != "delivered" && x.State != "attended" && x.State != "no-show"),
            "billable" => rows.Where(x => x.SaleId == null && (x.State == "ready" || x.State == "attended" || x.State == "delivered")),
            _ => throw new CommerceFailure("El filtro de la agenda u órdenes no es válido."),
        };
        var pageResult = await CommerceReads.PageAsync(Project(db, rows), page, ct);
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
        var active = rows.Where(x => x.State != "delivered" && x.State != "attended" && x.State != "no-show");
        return new(await active.CountAsync(x => x.Day == today, ct), await active.CountAsync(x => x.Day < today, ct),
            await rows.CountAsync(x => x.SaleId == null && (x.State == "ready" || x.State == "attended" || x.State == "delivered"), ct));
    }

    private sealed record WithCustomer(WorkItem Item, string CustomerName);

    private static IQueryable<WithCustomer> Project(KhypuPymeDbContext db, IQueryable<WorkItem> rows) =>
        from row in rows
        join customer in db.Set<Customer>().AsNoTracking() on new { row.BusinessId, Id = row.CustomerId } equals new { customer.BusinessId, customer.Id }
        orderby row.Day, row.StartMinute, row.Id
        select new WithCustomer(row, customer.Name);

    private static WorkInfo ProjectInfo(WithCustomer data)
    {
        var row = data.Item;
        return new(row.Id, row.Title, row.Industry, row.CustomerId, data.CustomerName, row.ServiceId, row.Day, row.StartMinute,
            row.Duration, row.BudgetMinor, row.Address, WorkDetails.Read(row.DetailsJson), row.State, row.Revision, row.SaleId, row.ReceiptId, row.DeliveredOn);
    }
}
