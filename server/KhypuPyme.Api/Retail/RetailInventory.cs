using System.Globalization;
using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal sealed class RetailInventory(CommerceTransaction work)
{
    private readonly HashSet<(Guid, string)> touched = [];
    private DbSet<RetailLot> Lots => work.Db.Set<RetailLot>();

    public static IQueryable<RetailLot> SellableLots(IQueryable<RetailLot> lots, DateOnly day) =>
        lots.Where(x => !x.Held && (x.ExpiresOn == null || x.ExpiresOn >= day));

    public async Task<LotAllocation[]> BuyAsync(Product product, RetailInput input, decimal quantity, long cost)
    {
        if (!product.TrackLots)
        {
            if (input.Lot is not null || input.ExpiresOn is not null)
                throw new CommerceFailure("Habilita el control de lotes al crear la ficha para usar esta entrada.");
            Add(product, quantity, cost);
            return [];
        }
        var code = LotCode(input.Lot);
        var allocation = new LotAllocation(code, input.ExpiresOn, quantity, cost);
        await AddLotAsync(product, allocation);
        Add(product, quantity, cost);
        return [allocation];
    }

    public async Task<(long Cost, LotAllocation[] Lots)> RemoveAsync(Product product, RetailInput input, decimal quantity,
        bool loss = false, bool preferredLot = false)
    {
        if (input.ExpiresOn is not null || input.Lot is not null && (!product.TrackLots || !loss && !preferredLot && work.Business.Industry != "pets"))
            throw new CommerceFailure("La venta asigna automáticamente primero el lote vendible más próximo a vencer.");
        if (!product.TrackLots)
        {
            if (quantity > product.MeasureStock) throw Shortage(product, quantity, product.MeasureStock);
            var cost = RetailMeasures.Proportion(product.ValueMinor, 0, quantity, product.MeasureStock);
            Subtract(product, quantity, cost);
            return (cost, []);
        }

        var query = Lots.Where(x => x.ProductId == product.Id && x.Quantity > 0);
        if (!loss) query = SellableLots(query, work.Today);
        if (loss || input.Lot is not null)
        {
            var code = LotCode(input.Lot);
            query = query.Where(x => x.Lot == code);
        }
        var rows = await query.OrderBy(x => x.ExpiresOn == null).ThenBy(x => x.ExpiresOn).ThenBy(x => x.Lot).Take(101).ToArrayAsync(work.Ct);
        var available = rows.Sum(x => x.Quantity);
        if (available < quantity && rows.Length < 101) throw Shortage(product, quantity, available);
        var selected = new List<LotAllocation>();
        decimal remaining = quantity;
        foreach (var lot in rows)
        {
            if (remaining == 0) break;
            Touch(product.Id, lot.Lot);
            var consumed = Math.Min(remaining, lot.Quantity);
            var cost = RetailMeasures.Proportion(lot.ValueMinor, 0, consumed, lot.Quantity);
            lot.Quantity -= consumed;
            lot.ValueMinor -= cost;
            remaining -= consumed;
            selected.Add(new LotAllocation(lot.Lot, lot.ExpiresOn, consumed, cost));
        }
        var total = selected.Sum(x => x.CostMinor);
        Subtract(product, quantity, total);
        return (total, selected.ToArray());
    }

    public async Task<Guid> CorrectLotAsync()
    {
        if (work.Business.Industry is not ("cosmetics" or "convenience"))
            throw new CommerceFailure("Esta corrección corresponde a los lotes de tienda o cosméticos.");
        var product = await work.ProductAsync(work.Command.EntityId ?? Guid.Empty);
        var code = LotCode(work.Command.Code);
        var lot = await Lots.FindAsync([product.BusinessId, product.Id, code], work.Ct);
        if (lot is null || lot.Quantity == 0)
            throw new CommerceFailure("Ese lote no tiene existencias.", 409);
        var entry = await work.NewEntryAsync("LOT");
        entry.Note = Text(work.Command.Note, 240, "el motivo de la corrección", true);
        var baseQuantity = lot.Quantity;
        var allocation = new LotAllocation(lot.Lot, lot.ExpiresOn, baseQuantity, lot.ValueMinor);
        switch (work.Command.Kind)
        {
            case "hold-lot" when !lot.Held:
                lot.Held = true;
                break;
            case "release-lot" when lot.Held && (lot.ExpiresOn == null || lot.ExpiresOn >= work.Today):
                lot.Held = false;
                break;
            case "discard-lot":
                entry.TotalMinor = entry.LossesMinor = lot.ValueMinor;
                Subtract(product, lot.Quantity, lot.ValueMinor);
                lot.Quantity = 0;
                lot.ValueMinor = 0;
                break;
            default:
                throw new CommerceFailure("El estado del lote cambió o el lote está vencido. Actualiza existencias.", 409);
        }
        var unit = product.RetailUnit switch { "piece" => "piece", "ml" or "l" => "ml", _ => "g" };
        var measure = new RetailInput(baseQuantity.ToString("0.########", CultureInfo.InvariantCulture), unit);
        entry.Lines.Add(new EntryLine { BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = product.Id,
            Name = product.Name, Code = product.Code, Quantity = 1, BaseQuantity = baseQuantity, SubtotalMinor = entry.TotalMinor,
            CostMinor = entry.LossesMinor, DetailsJson = LineDetails.Save(new(measure, baseQuantity, [allocation])) });
        return entry.Id;
    }

    public async Task<(long Cost, LotAllocation[] Lots)> RefundAsync(Product product, LineDetails detail, decimal before, decimal count,
        long originalCost, bool restock)
    {
        if (detail.Lots is not { Length: > 0 })
        {
            var cost = RetailMeasures.Proportion(originalCost, before, before + count, detail.BaseQuantity!.Value);
            if (restock) Add(product, count, cost);
            return (cost, []);
        }
        decimal position = 0;
        var selected = new List<LotAllocation>();
        foreach (var allocation in detail.Lots)
        {
            var from = Math.Max(before, position);
            var to = Math.Min(before + count, position + allocation.Quantity);
            if (from < to)
            {
                var cost = RetailMeasures.Proportion(allocation.CostMinor, from - position, to - position, allocation.Quantity);
                var returned = allocation with { Quantity = to - from, CostMinor = cost };
                selected.Add(returned);
                if (restock) await AddLotAsync(product, returned);
            }
            position += allocation.Quantity;
        }
        var total = selected.Sum(x => x.CostMinor);
        if (restock) Add(product, count, total);
        return (total, selected.ToArray());
    }

    private async Task AddLotAsync(Product product, LotAllocation input)
    {
        Touch(product.Id, input.Lot);
        var lot = await Lots.FindAsync([product.BusinessId, product.Id, input.Lot], work.Ct);
        if (lot is null)
            lot = Lots.Add(new RetailLot { BusinessId = product.BusinessId, ProductId = product.Id, Lot = input.Lot, ExpiresOn = input.ExpiresOn }).Entity;
        if (lot.ExpiresOn != input.ExpiresOn)
            throw new CommerceFailure("Ese lote ya tiene otra fecha de vencimiento. Revisa la etiqueta.", 409);
        lot.Quantity += input.Quantity;
        lot.ValueMinor += input.CostMinor;
    }

    private static void Add(Product product, decimal quantity, long cost)
    {
        var maximum = product.RetailUnit == "piece" ? QuantityLimit : RetailMeasures.MaxBase;
        if (product.MeasureStock + quantity > maximum)
            throw new CommerceFailure("La entrada supera el límite de existencias del producto.");
        product.MeasureStock += quantity;
        product.ValueMinor = Money(product.ValueMinor + cost, "un valor de existencias");
    }

    private static void Subtract(Product product, decimal quantity, long cost)
    {
        product.MeasureStock -= quantity;
        product.ValueMinor -= cost;
    }

    private void Touch(Guid product, string lot)
    {
        if (touched.Add((product, lot)) && touched.Count > 100)
            throw new CommerceFailure("Divide la operación. Puede afectar hasta 100 lotes.");
    }

    internal static string LotCode(string? raw) =>
        Text(Text(raw, 60, "el lote", true).ToUpperInvariant(), 60, "el lote", true);

    private static CommerceFailure Shortage(Product product, decimal requested, decimal available)
    {
        var profile = StoreProfiles.Retail(product)!;
        var factor = RetailMeasures.Factor(profile.Unit, profile, false);
        var unit = profile.Unit switch { "piece" => "unidades", "ml" => "mL", "l" => "L", _ => profile.Unit };
        return new CommerceFailure($"{product.Name}: pedido {requested / factor:0.########}, disponible {available / factor:0.########}, faltan {(requested - available) / factor:0.########} {unit}. Revisa las existencias vendibles.", 409);
    }
}
