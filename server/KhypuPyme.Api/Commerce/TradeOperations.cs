using System.Numerics;
using Microsoft.EntityFrameworkCore;
using KhypuPyme.Api.Timber;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class TradeOperations(CommerceTransaction work)
{
    private readonly TimberInventory inventory = new(work);
    public async Task<Guid> PurchaseAsync()
    {
        var rows = await PrepareAsync(useCatalogPrice: false);
        var entry = await work.NewEntryAsync("COM");
        entry.Method = Payment(work.Command.Method);
        entry.TotalMinor = entry.PurchasesMinor = Total(rows.Select(x => x.Subtotal));
        foreach (var row in rows)
        {
            await inventory.AddAsync(row.Product, row.Timber, row.Quantity, row.Subtotal);
            entry.Lines.Add(Snapshot(entry, row, row.Subtotal, row.Subtotal));
        }
        await work.ApplyCashAsync(entry, -entry.TotalMinor);
        return entry.Id;
    }

    public async Task<Guid> SellAsync()
    {
        var quote = work.Command.Kind == "quote";
        var rows = await PrepareAsync(useCatalogPrice: true);
        var gross = Total(rows.Select(x => x.Subtotal));
        var discount = Money(work.Command.DiscountMinor ?? 0, "un descuento");
        if (discount > gross) throw new CommerceFailure("El descuento supera el subtotal.");

        var entry = await work.NewEntryAsync(quote ? "COT" : "VEN");
        if (work.Command.CustomerId is Guid customerId)
        {
            var customer = await work.CustomerAsync(customerId);
            entry.CustomerId = customer.Id;
            entry.CustomerName = customer.Name;
        }
        else entry.CustomerName = "Cliente ocasional";
        entry.TotalMinor = gross - discount;
        entry.DiscountMinor = discount;
        if (quote) entry.ExpiresOn = work.Today.AddDays(7);
        else
        {
            entry.Method = Payment(work.Command.Method, allowCredit: true);
            if (work.Command.SourceId is not null) await LinkQuoteAsync(entry, rows);
            if (entry.Method == "credit")
            {
                if (entry.CustomerId is not Guid registered || entry.TotalMinor == 0)
                    throw new CommerceFailure("Una venta fiada requiere un cliente registrado y un importe positivo.");
                work.Db.Add(new Receivable
                {
                    BusinessId = work.Business.Id, SaleId = entry.Id, CustomerId = registered,
                    OriginalMinor = entry.TotalMinor, BalanceMinor = entry.TotalMinor,
                });
                entry.DebtDeltaMinor = entry.TotalMinor;
            }
        }

        long runningGross = 0;
        foreach (var row in rows)
        {
            var net = row.Subtotal - Share(discount, runningGross, runningGross + row.Subtotal, gross);
            runningGross += row.Subtotal;
            var cost = quote ? 0 : await inventory.RemoveAsync(row.Product, row.Timber, row.Quantity);
            entry.CostMinor += cost;
            entry.Lines.Add(Snapshot(entry, row, net, cost));
        }
        if (!quote)
        {
            entry.SalesMinor = entry.TotalMinor;
            await work.ApplyCashAsync(entry, entry.TotalMinor);
        }
        return entry.Id;
    }

    private async Task LinkQuoteAsync(Entry entry, TradeRow[] rows)
    {
        var source = await work.SourceAsync("quote", includeLines: true);
        if (source.ExpiresOn < work.Today || await work.Db.Set<Entry>().AnyAsync(x => x.Kind == "sale" && x.SourceId == source.Id, work.Ct))
            throw new CommerceFailure("La cotización venció o ya se convirtió en venta.", 409);
        if (source.CustomerId != entry.CustomerId || source.DiscountMinor != entry.DiscountMinor ||
            rows.Length != source.Lines.Count || rows.Any(row => !source.Lines.Any(line =>
                line.ProductId == row.Product.Id && line.Quantity == row.Quantity && line.UnitMinor == row.UnitMinor && line.Timber == row.Timber)))
            throw new CommerceFailure("La cotización cambió. Emite otra antes de convertirla.", 409);
        entry.SourceId = source.Id;
    }

    public async Task<Guid> ReturnAsync()
    {
        var requested = Lines(work.Command.Lines, returning: true);
        var sale = await work.SourceAsync("sale", includeLines: true);
        var returned = await work.Db.Set<Entry>()
            .Where(x => x.Kind == "return" && x.SourceId == sale.Id)
            .SelectMany(x => x.Lines).GroupBy(x => x.OriginalLineId ?? x.ProductId)
            .ToDictionaryAsync(group => group.Key, group => group.Sum(row => row.Quantity), work.Ct);

        var entry = await work.NewEntryAsync("DEV");
        entry.TimberUnits = sale.TimberUnits;
        entry.SourceId = sale.Id;
        entry.CustomerId = sale.CustomerId;
        entry.CustomerName = sale.CustomerName;
        entry.Note = Text(work.Command.Note, 240, "el motivo de la devolución", true);
        entry.Method = Payment(work.Command.Method);
        var selected = new HashSet<Guid>();
        foreach (var input in requested)
        {
            var original = sale.Lines.SingleOrDefault(x => x.ProductId == input.ProductId &&
                (input.OriginalLineId is null ? x.LengthMicros == null : x.LineId == input.OriginalLineId))
                ?? throw new CommerceFailure("El producto no pertenece a la venta original.");
            if (!selected.Add(original.LineId)) throw new CommerceFailure("Indica una cantidad por línea de la venta original.");
            var before = returned.GetValueOrDefault(original.LineId);
            if (before + input.Quantity > original.Quantity)
                throw new CommerceFailure($"Solo quedan {original.Quantity - before} piezas de {original.Name} por devolver.", 409);
            var refund = Share(original.SubtotalMinor, before, before + input.Quantity, original.Quantity);
            var cost = Share(original.CostMinor, before, before + input.Quantity, original.Quantity);
            var restock = input.Restock ?? true;
            if (restock) await inventory.AddAsync(await work.ProductAsync(input.ProductId), original.Timber, input.Quantity, cost);
            else entry.LossesMinor += cost;
            entry.TotalMinor += refund;
            entry.CostMinor -= cost;
            entry.Lines.Add(new EntryLine
            {
                BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = original.ProductId,
                Name = original.Name, Code = original.Code, Quantity = input.Quantity, OriginalLineId = original.LineId,
                UnitMinor = original.UnitMinor, SubtotalMinor = refund, CostMinor = cost, Restocked = restock,
                Species = original.Species, LengthMicros = original.LengthMicros, ThicknessMicros = original.ThicknessMicros,
                WidthMicros = original.WidthMicros,
            });
        }

        var debt = await work.Db.Set<Receivable>().FindAsync([work.Business.Id, sale.Id], work.Ct);
        var credit = Math.Min(debt?.BalanceMinor ?? 0, entry.TotalMinor);
        if (debt is not null) debt.BalanceMinor -= credit;
        var paidRefund = entry.TotalMinor - credit;
        entry.DebtDeltaMinor = -credit;
        entry.SalesMinor = -entry.TotalMinor;
        if (paidRefund == 0 && credit > 0) entry.Method = "credit";
        await work.ApplyCashAsync(entry, -paidRefund);
        return entry.Id;
    }

    public async Task<Guid> LossAsync()
    {
        var inputs = Lines(work.Command.Lines);
        var entry = await work.NewEntryAsync("MER");
        entry.Note = Text(work.Command.Note, 240, "el motivo de la salida", true);
        foreach (var line in inputs)
        {
            var product = await work.ProductAsync(line.ProductId);
            var dimension = TimberInventory.Check(product, line.Timber);
            var cost = await inventory.RemoveAsync(product, dimension, line.Quantity);
            entry.LossesMinor += cost;
            entry.Lines.Add(Snapshot(entry, new TradeRow(product, line.Quantity, 0, 0, dimension), cost, cost));
        }
        entry.TotalMinor = Total(entry.Lines.Select(x => x.CostMinor));
        return entry.Id;
    }

    private async Task<TradeRow[]> PrepareAsync(bool useCatalogPrice)
    {
        var inputs = Lines(work.Command.Lines);
        var rows = new List<TradeRow>(inputs.Length);
        foreach (var line in inputs)
        {
            var product = await work.ProductAsync(line.ProductId);
            if (!product.Active) throw new CommerceFailure($"{product.Name} está archivado.", 409);
            var dimension = TimberInventory.Check(product, line.Timber);
            var unit = Money(line.UnitMinor, useCatalogPrice ? "el precio unitario" : "el costo unitario");
            if (useCatalogPrice && unit != (dimension is null ? product.PriceMinor : TimberMeasures.Rate(product, dimension)))
                throw new CommerceFailure($"Cambió el precio de {product.Name}. Actualízalo y vuelve a revisar.", 409);
            var subtotal = useCatalogPrice && dimension is not null ? 0 : Money(unit * line.Quantity, "un subtotal");
            rows.Add(new TradeRow(product, line.Quantity, unit, subtotal, dimension));
        }
        if (useCatalogPrice)
        {
            var groups = rows.Select((row, index) => (row, index)).Where(x => x.row.Timber is not null)
                .GroupBy(x => (x.row.Product.Id, x.row.Timber!.LengthMicros, x.row.Timber.ThicknessMicros, x.row.UnitMinor));
            foreach (var group in groups)
            {
                BigInteger cumulative = 0;
                long before = 0;
                foreach (var (row, index) in group.OrderBy(x => x.row.Timber!.WidthMicros))
                {
                    cumulative += TimberMeasures.Volume(row.Timber!, row.Quantity);
                    var after = TimberMeasures.Total(cumulative, row.UnitMinor);
                    rows[index] = row with { Subtotal = after - before };
                    before = after;
                }
            }
        }
        return rows.ToArray();
    }

    private static EntryLine Snapshot(Entry entry, TradeRow row, long subtotal, long cost) => new()
    {
        BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = row.Product.Id,
        Name = row.Product.Name, Code = row.Product.Code, Quantity = row.Quantity,
        UnitMinor = row.UnitMinor, SubtotalMinor = subtotal, CostMinor = cost,
        Species = row.Product.Species, LengthMicros = row.Timber?.LengthMicros, ThicknessMicros = row.Timber?.ThicknessMicros,
        WidthMicros = row.Timber?.WidthMicros,
    };

    private sealed record TradeRow(Product Product, int Quantity, long UnitMinor, long Subtotal, TimberDimensions? Timber);
}
