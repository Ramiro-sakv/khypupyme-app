using System.Globalization;
using KhypuPyme.Api.Commerce;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal sealed class CementOperations(CommerceTransaction work)
{
    public async Task<Guid> OpenAsync()
    {
        if (work.Business.Industry != "cement" || work.Command.StockQuantity is not int bags || bags is < 1 or > QuantityLimit)
            throw new CommerceFailure("Elige un lote y una cantidad positiva de bolsas.");
        var source = await work.ProductAsync(work.Command.EntityId ?? Guid.Empty);
        if (!source.Active || MaterialProfiles.Read(source)?.Cement is not { BulkProductId: Guid id } profile)
            throw new CommerceFailure("Habilita el granel en la ficha de bolsas.");
        var bulk = await work.ProductAsync(id);
        if (!bulk.Active || bulk.CementSourceId != source.Id)
            throw new CommerceFailure("La ficha de granel no está disponible.", 409);

        var lot = RetailInventory.LotCode(work.Command.Code);
        var input = new RetailInput(bags.ToString(CultureInfo.InvariantCulture), "piece", lot);
        var stock = new RetailInventory(work);
        var removed = await stock.RemoveAsync(source, input, bags, preferredLot: true);
        if (work.Command.AmountMinor is long expected && expected != removed.Cost)
            throw new CommerceFailure("Cambió el valor del lote. Actualiza y revisa la apertura.", 409);
        var kg = profile.BagKg * bags;
        var destination = new RetailInput(kg.ToString(CultureInfo.InvariantCulture), "kg", lot, removed.Lots[0].ExpiresOn);
        var added = await stock.BuyAsync(bulk, destination, kg * 1000, removed.Cost);

        var entry = await work.NewEntryAsync("GR");
        entry.Lines.Add(Line(entry, source, input, bags, removed.Lots, removed.Cost, "opened-bags"));
        entry.Lines.Add(Line(entry, bulk, destination, kg * 1000, added, removed.Cost, "bulk-entry"));
        return entry.Id;
    }

    private static EntryLine Line(Entry entry, Product product, RetailInput measure, decimal quantity,
        LotAllocation[] lots, long value, string direction) => new()
    {
        BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = product.Id, Name = product.Name, Code = product.Code,
        Quantity = 1, BaseQuantity = quantity, CostMinor = value, SubtotalMinor = value,
        DetailsJson = LineDetails.Save(new(measure, quantity, lots, Direction: direction, Specialty: SpecialtyProfiles.Read(product))),
    };
}
