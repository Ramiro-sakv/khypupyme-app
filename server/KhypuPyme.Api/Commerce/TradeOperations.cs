using System.Numerics;
using Microsoft.EntityFrameworkCore;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class TradeOperations(CommerceTransaction work)
{
    private readonly TimberInventory inventory = new(work);
    private readonly RetailInventory retail = new(work);
    private readonly EquipmentInventory equipment = new(work);
    public Task<Guid> PurchaseAsync() => ReceiveAsync(stockAdjustment: false);
    public Task<Guid> StockInAsync() => ReceiveAsync(stockAdjustment: true);

    private async Task<Guid> ReceiveAsync(bool stockAdjustment)
    {
        var rows = await PrepareAsync(useCatalogPrice: false);
        var entry = await work.NewEntryAsync(stockAdjustment ? "ENT" : "COM");
        entry.TotalMinor = Total(rows.Select(x => x.Subtotal));
        if (stockAdjustment)
        {
            entry.Note = Text(work.Command.Note, 240, "el motivo del ajuste de inventario", true);
            if (work.Command.Method is not null) throw new CommerceFailure("Una entrada manual no admite forma de pago.");
        }
        else
        {
            entry.Method = Payment(work.Command.Method);
            entry.PurchasesMinor = entry.TotalMinor;
        }
        foreach (var row in rows)
        {
            if (row.Measure is { } measure)
            {
                var lots = await retail.BuyAsync(row.Product, measure, row.BaseQuantity!.Value, row.Subtotal);
                entry.Lines.Add(Snapshot(entry, row, row.Subtotal, row.Subtotal, new(measure, row.BaseQuantity, lots, RateUnit: measure.Unit)));
            }
            else if (row.Serials is { Length: > 0 } serials)
            {
                foreach (var serial in serials)
                {
                    await equipment.BuyAsync(row.Product, serial, row.UnitMinor, entry);
                    entry.Lines.Add(Snapshot(entry, row with { Quantity = 1 }, row.UnitMinor, row.UnitMinor, new(Serial: serial)));
                }
            }
            else
            {
                await inventory.AddAsync(row.Product, row.Timber, row.Quantity, row.Subtotal);
                entry.Lines.Add(Snapshot(entry, row, row.Subtotal, row.Subtotal,
                    row.TimberCostUnit is null ? null : new(TimberCostUnit: row.TimberCostUnit)));
            }
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
        var settings = await work.SettingsAsync();
        if ((quote || work.Command.SourceId is null) && discount > (decimal)gross * settings.MaxDiscountPercent / 100)
            throw new CommerceFailure($"El negocio permite un descuento máximo del {settings.MaxDiscountPercent}%.");

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
        if (quote) entry.ExpiresOn = work.Today.AddDays(settings.QuoteDays);
        else
        {
            entry.Method = Payment(work.Command.Method, allowCredit: true);
            if (work.Command.SourceId is not null) await LinkQuoteAsync(entry, rows);
            if (work.Command.WorkLink is not null) await new WorkOperations(work).LinkSaleAsync(entry, work.Command.Lines!);
            if (entry.Method == "credit")
            {
                if (!settings.AllowNewCredit) throw new CommerceFailure("El negocio tiene desactivados los fiados nuevos.");
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
            await AddSaleLinesAsync(entry, row, net, quote);
        }
        if (!quote)
        {
            entry.SalesMinor = entry.TotalMinor;
            await new ContainerService(work).MoveAsync(entry, work.Command.Containers);
            await work.ApplyCashAsync(entry, entry.TotalMinor);
        }
        return entry.Id;
    }

    private async Task AddSaleLinesAsync(Entry entry, TradeRow row, long net, bool quote, string? direction = null)
    {
        if (row.Printing is { } printing)
        {
            entry.Lines.Add(Snapshot(entry, row, net, 0, new(Printing: printing, RateUnit: "face")));
        }
        else if (row.Product.IsService)
        {
            entry.Lines.Add(Snapshot(entry, row, net, 0, new(IsService: true)));
        }
        else if (!quote && row.Serials is { Length: > 0 } serials)
        {
            for (var i = 0; i < serials.Length; i++)
            {
                var unit = await equipment.SellAsync(row.Product, serials[i], entry);
                entry.CostMinor += unit.CostMinor;
                entry.Lines.Add(Snapshot(entry, row with { Quantity = 1 }, Share(net, i, i + 1, serials.Length), unit.CostMinor,
                    new(Serial: unit.Serial, WarrantyUntil: unit.WarrantyUntil, Direction: direction)));
            }
        }
        else if (row.Measure is { } measure)
        {
            var take = quote ? (Cost: 0L, Lots: Array.Empty<LotAllocation>()) :
                await retail.RemoveAsync(row.Product, measure, row.BaseQuantity!.Value);
            entry.CostMinor += take.Cost;
            entry.Lines.Add(Snapshot(entry, row, net, take.Cost,
                new(measure, row.BaseQuantity, take.Lots, Direction: direction, RateUnit: row.Product.RetailUnit, Tile: row.Tile)));
        }
        else
        {
            var cost = quote ? 0 : await inventory.RemoveAsync(row.Product, row.Timber, row.Quantity);
            entry.CostMinor += cost;
            var variant = StoreProfiles.Apparel(row.Product);
            if (quote && row.Product.WarrantyMonths is not null) direction = "choose-series";
            entry.Lines.Add(Snapshot(entry, row, net, cost, variant is null && direction is null && row.TimberCatalogMinor is null ? null :
                new(Apparel: variant, Direction: direction, TimberCatalogMinor: row.TimberCatalogMinor)));
        }
    }

    private async Task LinkQuoteAsync(Entry entry, TradeRow[] rows)
    {
        var source = await work.SourceAsync("quote", includeLines: true);
        if (source.ExpiresOn < work.Today || await work.Db.Set<Entry>().AnyAsync(x => x.Kind == "sale" && x.SourceId == source.Id, work.Ct))
            throw new CommerceFailure("La cotización venció o ya se convirtió en venta.", 409);
        if (source.CustomerId != entry.CustomerId || source.DiscountMinor != entry.DiscountMinor || source.TotalMinor != entry.TotalMinor ||
            rows.Length != source.Lines.Count || rows.Any(row => !source.Lines.Any(line =>
                line.ProductId == row.Product.Id && line.Quantity == row.Quantity && line.UnitMinor == row.UnitMinor &&
                line.Timber == row.Timber && line.BaseQuantity == row.BaseQuantity &&
                (line.Timber is null || (LineDetails.Parse(line.DetailsJson)?.TimberCatalogMinor is not null) == (row.TimberCatalogMinor is not null)) &&
                (row.Measure is null || LineDetails.Parse(line.DetailsJson)?.Measure?.Unit == row.Measure.Unit) &&
                (row.Printing is null || LineDetails.Parse(line.DetailsJson)?.Printing?.Job == row.Printing.Job) &&
                (row.Tile is null || LineDetails.Parse(line.DetailsJson)?.Tile == row.Tile))))
            throw new CommerceFailure("La cotización cambió. Emite otra antes de convertirla.", 409);
        entry.SourceId = source.Id;
    }

    public async Task<Guid> ReturnAsync()
    {
        var exchange = work.Command.Kind == "exchange";
        if (exchange && !SpecialtyProfiles.HasVariants(work.Business.Industry))
            throw new CommerceFailure("Los cambios por talla y color corresponden a ropa y calzado.");
        var requested = Lines(work.Command.Lines, returning: true);
        var sale = await work.SourceAsync("sale", includeLines: true, allowExchange: SpecialtyProfiles.HasVariants(work.Business.Industry));
        var returned = await work.Db.Set<Entry>()
            .Where(x => (x.Kind == "return" || x.Kind == "exchange") && x.SourceId == sale.Id)
            .SelectMany(x => x.Lines.Where(line => x.Kind == "return" || line.OriginalLineId != null))
            .GroupBy(x => x.OriginalLineId ?? x.ProductId)
            .ToDictionaryAsync(group => group.Key, group => group.Sum(row => row.BaseQuantity ?? row.Quantity), work.Ct);

        var entry = await work.NewEntryAsync(exchange ? "CAM" : "DEV");
        entry.TimberUnits = sale.TimberUnits;
        entry.SourceId = sale.Id;
        entry.CustomerId = sale.CustomerId;
        entry.CustomerName = sale.CustomerName;
        entry.Note = Text(work.Command.Note, 240, exchange ? "el motivo del cambio" : "el motivo de la devolución", true);
        entry.Method = Payment(work.Command.Method);
        var selected = new HashSet<Guid>();
        foreach (var input in requested)
        {
            var original = sale.Lines.SingleOrDefault(x => x.ProductId == input.ProductId && (sale.Kind != "exchange" || x.OriginalLineId == null) &&
                (input.OriginalLineId is null ? x.LengthMicros == null && x.DetailsJson == null : x.LineId == input.OriginalLineId))
                ?? throw new CommerceFailure("El producto no pertenece a la venta original.");
            if (!selected.Add(original.LineId)) throw new CommerceFailure("Indica una cantidad por línea de la venta original.");
            var before = returned.GetValueOrDefault(original.LineId);
            var product = await work.ProductAsync(input.ProductId);
            var details = LineDetails.Parse(original.DetailsJson);
            if (exchange && details?.Apparel is null)
                throw new CommerceFailure("Selecciona una variante de la venta original para el cambio.");
            var measure = input.Measure;
            var measured = details?.Measure is { } originalMeasure &&
                measure is not null && measure.Unit == (originalMeasure.Unit == "box" ? "piece" : originalMeasure.Unit == "roll" ? "m" : originalMeasure.Unit) &&
                measure.Lot is null && measure.ExpiresOn is null && measure.Loose is null;
            if ((details?.Measure is not null || measure is not null) && !measured ||
                input.Serials is not null || input.Timber is not null || input.Printing is not null || input.Tile is not null)
                throw new CommerceFailure("Usa la unidad y la identificación de la línea original.");
            var count = measured ? RetailMeasures.Convert(measure!, StoreProfiles.Retail(product)!, false).Base : input.Quantity;
            var whole = original.BaseQuantity ?? original.Quantity;
            if (before + count > whole)
                throw new CommerceFailure($"La cantidad de {original.Name} supera lo pendiente de la venta original.", 409);
            var refund = RetailMeasures.Proportion(original.SubtotalMinor, before, before + count, whole);
            var restock = input.Restock ?? true;
            if (details?.Printing is not null && restock)
                throw new CommerceFailure("La impresión se devuelve por caras cobradas. Elige devolución sin reintegro.");
            if (details?.IsService == true && restock)
                throw new CommerceFailure("El servicio se devuelve sin reintegro de inventario.");
            long cost;
            if (measured)
            {
                var result = await retail.RefundAsync(product, details!, before, count, original.CostMinor, restock);
                cost = result.Cost;
                details = details! with { Measure = measure, BaseQuantity = count, Lots = result.Lots };
                if (details.Tile is { } tile)
                    details = details with { Tile = tile with { DeliveredArea = tile.DeliveredArea * count / whole, RequiredArea = null } };
            }
            else
            {
                cost = RetailMeasures.Proportion(original.CostMinor, before, before + count, whole);
                if (details?.Serial is { } serial) await equipment.RefundAsync(product, serial, sale, entry, restock);
                else if (restock) await inventory.AddAsync(product, original.Timber, input.Quantity, cost);
            }
            if (!restock) entry.LossesMinor += cost;
            if (details is not null) details = details with { Direction = exchange ? "returned" : null };
            entry.TotalMinor += refund;
            entry.CostMinor -= cost;
            entry.Lines.Add(new EntryLine
            {
                BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = original.ProductId,
                Name = original.Name, Code = original.Code, Quantity = input.Quantity, OriginalLineId = original.LineId,
                UnitMinor = original.UnitMinor, SubtotalMinor = refund, CostMinor = cost, Restocked = restock,
                Species = original.Species, LengthMicros = original.LengthMicros, ThicknessMicros = original.ThicknessMicros,
                WidthMicros = original.WidthMicros, BaseQuantity = measured ? count : null, DetailsJson = LineDetails.Save(details),
            });
        }

        var debt = await work.Db.Set<Receivable>().FindAsync([work.Business.Id, sale.Id], work.Ct);
        var credit = Math.Min(debt?.BalanceMinor ?? 0, entry.TotalMinor);
        if (debt is not null) debt.BalanceMinor -= credit;
        var paidRefund = entry.TotalMinor - credit;
        entry.DebtDeltaMinor = -credit;
        entry.SalesMinor = -entry.TotalMinor;
        if (exchange)
        {
            var replacement = await PrepareAsync(useCatalogPrice: true, work.Command.ExchangeLines ?? []);
            if (replacement.Any(row => row.Product.Model is null || entry.Lines.Any(line => line.ProductId == row.Product.Id)))
                throw new CommerceFailure("Selecciona una variante de talla y color distinta como reemplazo.");
            var newTotal = Total(replacement.Select(row => row.Subtotal));
            foreach (var row in replacement) await AddSaleLinesAsync(entry, row, row.Subtotal, false, "replacement");
            entry.SalesMinor += newTotal;
            entry.TotalMinor = newTotal - paidRefund;
            if (work.Command.AmountMinor != entry.TotalMinor)
                throw new CommerceFailure("Cambió el importe del cambio. Vuelve a consultar la venta y revisa la diferencia.", 409);
            if (entry.TotalMinor != 0) await work.ApplyCashAsync(entry, entry.TotalMinor);
        }
        else
        {
            if (paidRefund == 0 && credit > 0) entry.Method = "credit";
            await work.ApplyCashAsync(entry, -paidRefund);
        }
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
            if (line.Tile is not null) throw new CommerceFailure("La cobertura se calcula en ventas y cotizaciones.");
            if (product.IsService) throw new CommerceFailure("El servicio no tiene existencias que dar de baja.");
            if (product.WarrantyMonths is not null)
                throw new CommerceFailure("La baja de un equipo se resuelve por su serie desde Inspección.");
            if (product.PrintingSize is not null || line.Printing is not null)
                throw new CommerceFailure("La impresión se registra como servicio desde la venta.");
            if (StoreProfiles.Retail(product) is { } profile)
            {
                var measure = line.Measure ?? throw new CommerceFailure("Indica la cantidad y la unidad de la salida.");
                var amount = RetailMeasures.Convert(measure, profile, false).Base;
                var loss = await retail.RemoveAsync(product, measure, amount, loss: true);
                entry.LossesMinor += loss.Cost;
                entry.Lines.Add(Snapshot(entry, new TradeRow(product, 1, 0, 0, null, measure, amount), loss.Cost, loss.Cost,
                    new(measure, amount, loss.Lots)));
                continue;
            }
            if (line.Measure is not null || line.Serials is not null)
                throw new CommerceFailure("La ficha no admite esas unidades de control.");
            var dimension = TimberInventory.Check(product, line.Timber);
            var cost = await inventory.RemoveAsync(product, dimension, line.Quantity);
            entry.LossesMinor += cost;
            entry.Lines.Add(Snapshot(entry, new TradeRow(product, line.Quantity, 0, 0, dimension), cost, cost));
        }
        entry.TotalMinor = Total(entry.Lines.Select(x => x.CostMinor));
        return entry.Id;
    }

    private async Task<TradeRow[]> PrepareAsync(bool useCatalogPrice, CommandLine[]? replacements = null)
    {
        var inputs = Lines(replacements ?? work.Command.Lines, buying: !useCatalogPrice);
        var rows = new List<TradeRow>(inputs.Length);
        foreach (var line in inputs)
        {
            var product = await work.ProductAsync(line.ProductId);
            if (!product.Active) throw new CommerceFailure($"{product.Name} está archivado.", 409);
            if (product.IsService && !useCatalogPrice) throw new CommerceFailure("Los servicios se cobran desde Ventas.");
            if (!useCatalogPrice && product.CementSourceId is not null)
                throw new CommerceFailure("Genera granel abriendo bolsas desde su lote.");
            if (line.Tile is not null && product.RetailUnit is null)
                throw new CommerceFailure("La cobertura corresponde a una ficha de cerámicas en venta o cotización.");
            var dimension = TimberInventory.Check(product, line.Timber);
            var unit = Money(line.UnitMinor, useCatalogPrice ? "el precio unitario" : "el costo unitario");
            var catalogUnit = dimension is null ? product.PriceMinor : TimberMeasures.Rate(product, dimension);
            if (useCatalogPrice && unit != catalogUnit && line.TimberRateManual != true)
                throw new CommerceFailure($"Cambió el precio de {product.Name}. Actualízalo y vuelve a revisar.", 409);
            var serials = equipment.Validate(product, line, required: work.Command.Kind != "quote");
            if (work.Command.Kind == "quote" && serials.Length > 0)
                throw new CommerceFailure("Selecciona la serie al confirmar la venta.");
            if (product.PrintingSize is not null || line.Printing is not null)
            {
                var printing = SpecialtyProfiles.Printing(product, line.Printing, useCatalogPrice);
                if (line.Measure is not null || line.Serials is not null || dimension is not null)
                    throw new CommerceFailure("La impresión usa copias y caras por copia.");
                rows.Add(new TradeRow(product, printing.Faces, unit, Money(unit * printing.Faces, "un subtotal"), null, Printing: printing));
            }
            else if (StoreProfiles.Retail(product) is { } profile)
            {
                var measure = line.Measure ?? throw new CommerceFailure("Indica la cantidad y la unidad del producto.");
                var (stored, coverage) = RetailMeasures.ForTrade(product, profile, measure, work.Business.Industry,
                    buying: !useCatalogPrice, quote: work.Command.Kind == "quote", line.Tile);
                var factor = RetailMeasures.Factor(useCatalogPrice ? profile.Unit : measure.Unit, profile, !useCatalogPrice || measure.Unit == "box");
                var subtotal = RetailMeasures.Subtotal(unit, stored, factor);
                rows.Add(new TradeRow(product, profile.Unit == "piece" ? (int)stored : 1, unit, subtotal, null, measure, stored, Tile: coverage));
            }
            else
            {
                if (line.Measure is not null) throw new CommerceFailure("La ficha no admite esa unidad.");
                var subtotal = dimension is not null && (useCatalogPrice || line.TimberCostUnit is not null)
                    ? 0 : Money(unit * line.Quantity, "un subtotal");
                rows.Add(new TradeRow(product, line.Quantity, unit, subtotal, dimension, Serials: serials,
                    TimberCatalogMinor: line.TimberRateManual == true ? catalogUnit : null, TimberCostUnit: line.TimberCostUnit));
            }
        }
        var groups = rows.Select((row, index) => (row, index))
            .Where(x => x.row.Timber is not null && (useCatalogPrice || x.row.TimberCostUnit is not null))
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
        return rows.ToArray();
    }

    private static EntryLine Snapshot(Entry entry, TradeRow row, long subtotal, long cost, LineDetails? details = null) => new()
    {
        BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = row.Product.Id,
        Name = row.Product.Name, Code = row.Product.Code, Quantity = row.Quantity,
        UnitMinor = row.UnitMinor, SubtotalMinor = subtotal, CostMinor = cost,
        Species = row.Product.Species, LengthMicros = row.Timber?.LengthMicros, ThicknessMicros = row.Timber?.ThicknessMicros,
        WidthMicros = row.Timber?.WidthMicros,
        BaseQuantity = row.BaseQuantity, DetailsJson = LineDetails.Save(AddDescription(row.Product, details)),
    };

    private static LineDetails? AddDescription(Product product, LineDetails? details)
    {
        var specialty = SpecialtyProfiles.Read(product);
        return specialty is null ? details : (details ?? new()) with { Specialty = specialty };
    }

    private sealed record TradeRow(Product Product, int Quantity, long UnitMinor, long Subtotal, TimberDimensions? Timber,
        RetailInput? Measure = null, decimal? BaseQuantity = null, string[]? Serials = null, PrintingDetail? Printing = null, TileCoverage? Tile = null,
        long? TimberCatalogMinor = null, string? TimberCostUnit = null);
}
