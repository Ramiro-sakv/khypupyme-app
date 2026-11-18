using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class TradeOperations(CommerceTransaction work)
{
    public async Task<Guid> PurchaseAsync()
    {
        var rows = await PrepareAsync(useCatalogPrice: false);
        var entry = await work.NewEntryAsync("COM");
        entry.Method = Payment(work.Command.Method);
        entry.TotalMinor = entry.PurchasesMinor = Total(rows.Select(x => x.Subtotal));
        foreach (var row in rows)
        {
            AddStock(row.Product, row.Quantity, row.Subtotal);
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
            var cost = quote ? 0 : RemoveStock(row.Product, row.Quantity);
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
                line.ProductId == row.Product.Id && line.Quantity == row.Quantity && line.UnitMinor == row.UnitMinor)))
            throw new CommerceFailure("La cotización cambió. Emite otra antes de convertirla.", 409);
        entry.SourceId = source.Id;
    }

    public async Task<Guid> ReturnAsync()
    {
        var requested = Lines(work.Command.Lines);
        var sale = await work.SourceAsync("sale", includeLines: true);
        var returned = await work.Db.Set<Entry>()
            .Where(x => x.Kind == "return" && x.SourceId == sale.Id)
            .SelectMany(x => x.Lines).GroupBy(x => x.ProductId)
            .ToDictionaryAsync(group => group.Key, group => group.Sum(row => row.Quantity), work.Ct);

        var entry = await work.NewEntryAsync("DEV");
        entry.SourceId = sale.Id;
        entry.CustomerId = sale.CustomerId;
        entry.CustomerName = sale.CustomerName;
        entry.Note = Text(work.Command.Note, 240, "el motivo de la devolución", true);
        entry.Method = Payment(work.Command.Method);
        foreach (var input in requested)
        {
            var original = sale.Lines.SingleOrDefault(x => x.ProductId == input.ProductId)
                ?? throw new CommerceFailure("El producto no pertenece a la venta original.");
            var before = returned.GetValueOrDefault(input.ProductId);
            if (before + input.Quantity > original.Quantity)
                throw new CommerceFailure($"Solo quedan {original.Quantity - before} piezas de {original.Name} por devolver.", 409);
            var refund = Share(original.SubtotalMinor, before, before + input.Quantity, original.Quantity);
            var cost = Share(original.CostMinor, before, before + input.Quantity, original.Quantity);
            var restock = input.Restock ?? true;
            if (restock) AddStock(await work.ProductAsync(input.ProductId), input.Quantity, cost);
            else entry.LossesMinor += cost;
            entry.TotalMinor += refund;
            entry.CostMinor -= cost;
            entry.Lines.Add(new EntryLine
            {
                BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = original.ProductId,
                Name = original.Name, Code = original.Code, Quantity = input.Quantity,
                UnitMinor = original.UnitMinor, SubtotalMinor = refund, CostMinor = cost, Restocked = restock,
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
            var cost = RemoveStock(product, line.Quantity);
            entry.LossesMinor += cost;
            entry.Lines.Add(Snapshot(entry, new TradeRow(product, line.Quantity, 0, 0), cost, cost));
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
            var unit = Money(line.UnitMinor, useCatalogPrice ? "el precio unitario" : "el costo unitario");
            if (useCatalogPrice && unit != product.PriceMinor)
                throw new CommerceFailure($"Cambió el precio de {product.Name}. Actualízalo y vuelve a revisar.", 409);
            rows.Add(new TradeRow(product, line.Quantity, unit, Money(unit * line.Quantity, "un subtotal")));
        }
        return rows.ToArray();
    }

    private static EntryLine Snapshot(Entry entry, TradeRow row, long subtotal, long cost) => new()
    {
        BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = row.Product.Id,
        Name = row.Product.Name, Code = row.Product.Code, Quantity = row.Quantity,
        UnitMinor = row.UnitMinor, SubtotalMinor = subtotal, CostMinor = cost,
    };

    private sealed record TradeRow(Product Product, int Quantity, long UnitMinor, long Subtotal);
}
