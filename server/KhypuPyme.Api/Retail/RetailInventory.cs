using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal sealed class RetailInventory(CommerceTransaction work)
{
    private readonly HashSet<(Guid, string)> touched = [];
    private DbSet<RetailLot> Lots => work.Db.Set<RetailLot>();

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

    public async Task<(long Cost, LotAllocation[] Lots)> RemoveAsync(Product product, RetailInput input, decimal quantity, bool loss = false)
    {
        if (input.ExpiresOn is not null || input.Lot is not null && (!loss || !product.TrackLots))
            throw new CommerceFailure("La venta asigna automáticamente primero el lote vendible más próximo a vencer.");
        if (!product.TrackLots)
        {
            if (quantity > product.MeasureStock) throw Shortage(product, quantity, product.MeasureStock);
            var cost = RetailMeasures.Proportion(product.ValueMinor, 0, quantity, product.MeasureStock);
            Subtract(product, quantity, cost);
            return (cost, []);
        }

        var query = Lots.Where(x => x.ProductId == product.Id && x.Quantity > 0);
        if (!loss) query = query.Where(x => x.ExpiresOn == null || x.ExpiresOn >= work.Today);
        else
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

    private static string LotCode(string? raw) =>
        Text(Text(raw, 60, "el lote", true).ToUpperInvariant(), 60, "el lote", true);

    private static CommerceFailure Shortage(Product product, decimal requested, decimal available)
    {
        var profile = StoreProfiles.Retail(product)!;
        var factor = RetailMeasures.Factor(profile.Unit, profile, false);
        var unit = profile.Unit switch { "piece" => "unidades", "ml" => "mL", "l" => "L", _ => profile.Unit };
        return new CommerceFailure($"{product.Name}: pedido {requested / factor:0.########}, disponible {available / factor:0.########}, faltan {(requested - available) / factor:0.########} {unit}. Revisa las existencias vendibles.", 409);
    }
}
