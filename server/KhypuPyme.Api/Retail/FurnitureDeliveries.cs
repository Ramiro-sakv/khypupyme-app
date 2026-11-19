using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

public sealed record DeliveryInput(string Mode, DateOnly Day, string? Address = null);
public sealed record DeliveryInfo(Guid SaleId, string Number, string? CustomerName, string Mode,
    DateOnly Day, string? Address, DateOnly? CompletedOn);

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
    public async Task<Guid> ExecuteAsync()
    {
        if (work.Business.Industry != "furniture")
            throw new CommerceFailure("La programación de entregas corresponde al rubro de muebles.");
        var sale = await work.SourceAsync("sale");
        var deliveries = work.Db.Set<FurnitureDelivery>();
        var delivery = await deliveries.FindAsync([sale.BusinessId, sale.Id], work.Ct);
        if (delivery?.CompletedOn is not null)
            throw new CommerceFailure("La entrega o retiro ya se completó.", 409);

        if (work.Command.Kind == "complete-delivery")
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

    public static IQueryable<DeliveryInfo> Query(KhypuPymeDbContext db, Guid? saleId = null)
    {
        var deliveries = db.Set<FurnitureDelivery>().AsNoTracking();
        if (saleId is Guid id) deliveries = deliveries.Where(row => row.SaleId == id);
        return from row in deliveries
               join sale in db.Set<Entry>().AsNoTracking() on new { row.BusinessId, Id = row.SaleId } equals new { sale.BusinessId, sale.Id }
               orderby row.CompletedOn != null, row.Day, row.SaleId
               select new DeliveryInfo(row.SaleId, sale.Number, sale.CustomerName, row.Mode, row.Day, row.Address, row.CompletedOn);
    }
}
