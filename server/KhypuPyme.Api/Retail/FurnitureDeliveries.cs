using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

public sealed record DeliveryInput(string Mode, DateOnly Day, string? Address = null);
public sealed record DeliveryInfo(Guid SaleId, string Number, string? CustomerName, string Mode,
    DateOnly Day, string? Address, DateOnly? CompletedOn, DateOnly? PreparedOn, DateOnly? CancelledOn);

public sealed record DeliveryAttention(int Today, int Overdue, int Pending, int Prepared);

internal sealed class FurnitureDelivery : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid SaleId { get; init; }
    public required string Mode { get; set; }
    public DateOnly Day { get; set; }
    public string? Address { get; set; }
    public DateOnly? CompletedOn { get; set; }
}

internal sealed class FurnitureDeliveries(CommerceTransaction work)
{
    public static bool Supported(string industry) => industry is "furniture" or "cement" or "ceramics" or "hardware" or "beverages" or "timber";

    public async Task<Guid> ExecuteAsync()
    {
        if (!Supported(work.Business.Industry))
            throw new CommerceFailure("Este rubro no dispone de programación de entregas.");
        var sale = await work.SourceAsync("sale");
        var deliveries = work.Db.Set<FurnitureDelivery>();
        var delivery = await deliveries.FindAsync([sale.BusinessId, sale.Id], work.Ct);
        var entries = work.Db.Set<Entry>().Where(row => row.SourceId == sale.Id && row.BusinessId == sale.BusinessId);
        if (await entries.AnyAsync(row => row.Kind == "cancel-delivery", work.Ct))
            throw new CommerceFailure("La entrega o retiro ya se canceló.", 409);
        if (work.Command.Kind == "delivery-receipt")
        {
            if (delivery is null) throw new CommerceFailure("Programa el retiro o la entrega antes de emitir la constancia.", 409);
            var receipt = await work.NewEntryAsync("DES");
            receipt.SourceId = sale.Id;
            receipt.CustomerId = sale.CustomerId;
            receipt.CustomerName = sale.CustomerName;
            receipt.Note = string.Join("\n", new[] {
                "Venta: " + sale.Number,
                "Modalidad: " + (delivery.Mode == "pickup" ? "Retiro en tienda" : "Entrega a domicilio"),
                "Fecha programada: " + delivery.Day.ToString("dd/MM/yyyy"),
                delivery.Address is null ? null : "Dirección: " + delivery.Address,
                delivery.CompletedOn is DateOnly completed ? "Completada el " + completed.ToString("dd/MM/yyyy") : null,
            }.OfType<string>());
            return receipt.Id;
        }
        if (delivery?.CompletedOn is not null)
            throw new CommerceFailure("La entrega o retiro ya se completó.", 409);

        if (work.Command.Kind is "prepare-delivery" or "cancel-delivery")
        {
            if (work.Command.Delivery is not null || delivery is null)
                throw new CommerceFailure("Programa el retiro o la entrega antes de cambiar su estado.", 409);
            var preparing = work.Command.Kind == "prepare-delivery";
            if (preparing && await entries.AnyAsync(row => row.Kind == "prepare-delivery", work.Ct))
                throw new CommerceFailure("La entrega ya está preparada.", 409);
            var entry = await work.NewEntryAsync(preparing ? "PRE" : "CAE");
            entry.SourceId = sale.Id;
            entry.CustomerId = sale.CustomerId;
            entry.CustomerName = sale.CustomerName;
            if (!preparing) entry.Note = Text(work.Command.Note, 240, "el motivo de cancelación", true);
        }
        else if (work.Command.Kind == "complete-delivery")
        {
            if (work.Command.Delivery is not null || delivery is null)
                throw new CommerceFailure("Programa el retiro o la entrega antes de completarla.", 409);
            delivery.CompletedOn = work.Today;
        }
        else
        {
            var input = work.Command.Delivery;
            if (input is null || input.Mode is not ("pickup" or "delivery") || input.Day < work.Today)
                throw new CommerceFailure("Elige retiro o entrega y una fecha desde hoy.");
            var address = input.Mode == "delivery" ? Text(input.Address, 240, "la dirección de entrega", true) : null;
            delivery ??= deliveries.Add(new FurnitureDelivery { BusinessId = sale.BusinessId, SaleId = sale.Id, Mode = input.Mode }).Entity;
            delivery.Mode = input.Mode;
            delivery.Day = input.Day;
            delivery.Address = address;
        }
        return sale.Id;
    }

    public static Task<CommercePage<DeliveryInfo>> ListAsync(KhypuPymeDbContext db, string? filter, string? mode,
        string? search, DateOnly today, int? page, CancellationToken ct)
    {
        var rows = Rows(db);
        var active = Pending(rows);
        rows = filter switch
        {
            null or "" => rows,
            "pending" => active,
            "today" => active.Where(x => x.Delivery.Day == today),
            "overdue" => active.Where(x => x.Delivery.Day < today),
            "prepared" => active.Where(x => x.PreparedOn != null),
            "completed" => rows.Where(x => x.Delivery.CompletedOn != null),
            "cancelled" => rows.Where(x => x.CancelledOn != null),
            _ => throw new CommerceFailure("Selecciona un estado de entrega válido."),
        };
        if (mode is not (null or "" or "pickup" or "delivery"))
            throw new CommerceFailure("Selecciona retiro o entrega.");
        if (!string.IsNullOrEmpty(mode)) rows = rows.Where(x => x.Delivery.Mode == mode);
        var term = CommerceReads.Search(search);
        if (term is not null)
            rows = rows.Where(x => EF.Functions.ILike(x.Sale.Number, term, "\\") ||
                x.Sale.CustomerName != null && EF.Functions.ILike(x.Sale.CustomerName, term, "\\") ||
                x.Delivery.Address != null && EF.Functions.ILike(x.Delivery.Address, term, "\\"));
        return CommerceReads.PageAsync(Describe(rows), page, ct);
    }

    public static async Task<DeliveryAttention> AttentionAsync(KhypuPymeDbContext db, DateOnly today, CancellationToken ct) =>
        await Pending(Rows(db)).GroupBy(_ => 1)
            .Select(group => new DeliveryAttention(group.Count(x => x.Delivery.Day == today), group.Count(x => x.Delivery.Day < today),
                group.Count(), group.Count(x => x.PreparedOn != null))).SingleOrDefaultAsync(ct) ?? new(0, 0, 0, 0);

    public static IQueryable<DeliveryInfo> Query(KhypuPymeDbContext db, Guid saleId) =>
        Describe(Rows(db).Where(x => x.Delivery.SaleId == saleId));

    private static IQueryable<DeliveryRow> Pending(IQueryable<DeliveryRow> rows) =>
        rows.Where(x => x.Delivery.CompletedOn == null && x.CancelledOn == null);

    private sealed class DeliveryRow
    {
        public required FurnitureDelivery Delivery { get; init; }
        public required Entry Sale { get; init; }
        public DateOnly? PreparedOn { get; init; }
        public DateOnly? CancelledOn { get; init; }
    }

    private static IQueryable<DeliveryRow> Rows(KhypuPymeDbContext db)
    {
        var entries = db.Set<Entry>().AsNoTracking();
        return from row in db.Set<FurnitureDelivery>().AsNoTracking()
               join sale in entries on new { row.BusinessId, Id = row.SaleId } equals new { sale.BusinessId, sale.Id }
               select new DeliveryRow
               {
                   Delivery = row,
                   Sale = sale,
                   PreparedOn = entries.Where(x => x.BusinessId == row.BusinessId && x.SourceId == row.SaleId && x.Kind == "prepare-delivery")
                       .Select(x => (DateOnly?)x.Date).FirstOrDefault(),
                   CancelledOn = entries.Where(x => x.BusinessId == row.BusinessId && x.SourceId == row.SaleId && x.Kind == "cancel-delivery")
                       .Select(x => (DateOnly?)x.Date).FirstOrDefault(),
               };
    }

    private static IQueryable<DeliveryInfo> Describe(IQueryable<DeliveryRow> rows) =>
        rows.OrderBy(x => x.Delivery.CompletedOn != null).ThenBy(x => x.Delivery.Day).ThenBy(x => x.Delivery.SaleId)
            .Select(x => new DeliveryInfo(x.Delivery.SaleId, x.Sale.Number, x.Sale.CustomerName, x.Delivery.Mode, x.Delivery.Day,
                x.Delivery.Address, x.Delivery.CompletedOn, x.PreparedOn, x.CancelledOn));
}
