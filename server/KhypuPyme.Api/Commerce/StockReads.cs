using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Timber;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

public sealed record StockRequest(StockLine[] Lines, bool Receiving = false, bool Quote = false);
public sealed record StockLine(Guid ProductId, int Quantity, TimberDimensions? Timber = null, RetailInput? Measure = null,
    string[]? Serials = null, TileRequest? Tile = null);
public sealed record StockCheck(Guid ProductId, TimberDimensions? Timber, string? Serial, decimal Requested, decimal Available, string? Reason,
    string? Lot = null);
public sealed record WarehouseItem(ProductInfo Product, string Status);
public sealed record StockMovement(Guid EntryId, string Number, DateOnly Date, string Kind, string Note, int Quantity,
    TimberDimensions? Timber, LineDetails? Details, bool? Restocked);

internal sealed class StockReads(KhypuPymeDbContext db, StoreReads store, TimeProvider clock)
{
    private DateOnly Today => LocalDate(clock.GetUtcNow());

    public async Task<StockCheck[]> CheckAsync(Guid businessId, StockRequest request, CancellationToken ct)
    {
        if (request.Lines is not { Length: >= 1 and <= 100 } lines || lines.Any(x => x is null || x.Serials?.Length > 100))
            throw new CommerceFailure("Indica de 1 a 100 líneas para consultar el almacén.");
        var ids = lines.Select(x => x.ProductId).Distinct().ToArray();
        if (lines.Select(x => (x.ProductId, x.Timber?.LengthMicros, x.Timber?.ThicknessMicros)).Distinct().Count() > 20 ||
            lines.Sum(x => x.Serials?.Length ?? 0) > 100)
            throw new CommerceFailure("Se admiten 20 grupos y 100 series por operación.");

        var productRows = await (from product in db.Set<Product>().AsNoTracking()
                                 join business in db.Businesses.AsNoTracking() on product.BusinessId equals business.Id
                                 where product.BusinessId == businessId && ids.Contains(product.Id)
                                 select new { Product = product, business.Industry }).ToArrayAsync(ct);
        if (productRows.Length != ids.Length) throw new CommerceFailure("Un producto no está disponible en este negocio.", 404);
        var products = productRows.ToDictionary(x => x.Product.Id, x => x.Product);
        var result = await CheckSerialsAsync(businessId, request.Receiving, products, lines, ct);
        if (request.Receiving) return result.ToArray();

        var industry = productRows[0].Industry;
        var requested = lines.Where(x => x.Serials is not { Length: > 0 } && !products[x.ProductId].IsService)
            .Select(line => Prepare(line, products[line.ProductId], industry, request.Quote))
            .GroupBy(x => new { x.Product, x.Timber, x.Lot })
            .Select(group => new StockDemand(group.Key.Product, group.Key.Timber, group.Sum(x => x.Quantity), group.Key.Lot))
            .ToArray();

        var datedLots = await ReadLotsAsync(businessId, requested, ct);
        var timber = await ReadTimberAsync(businessId, requested, ct);
        var equipmentIds = requested.Where(x => x.Product.WarrantyMonths is not null && x.Quantity > x.Product.Stock)
            .Select(x => x.Product.Id).Distinct().ToArray();
        var inspections = equipmentIds.Length == 0 ? [] : await db.Set<EquipmentUnit>().AsNoTracking()
            .Where(x => x.BusinessId == businessId && equipmentIds.Contains(x.ProductId) && x.State == "inspection")
            .Select(x => x.ProductId).Distinct().ToArrayAsync(ct);

        foreach (var row in requested)
        {
            var product = row.Product;
            decimal available;
            string? reason = null;
            if (product.TrackLots)
            {
                var lots = datedLots[product.Id];
                if (row.Lot is not null)
                {
                    available = lots.Where(x => x.Lot == row.Lot).Sum(x => x.Quantity);
                    if (available == 0) reason = "Este lote no tiene existencias vendibles";
                }
                else
                {
                    var committed = requested.Where(x => x.Product == product && x.Lot is not null)
                        .Sum(x => Math.Min(x.Quantity, lots.Where(lot => lot.Lot == x.Lot).Sum(lot => lot.Quantity)));
                    var sellable = lots.Sum(x => x.Quantity);
                    available = sellable - committed;
                    if (available < row.Quantity && product.MeasureStock > sellable)
                        reason = "Hay existencias vencidas o apartadas";
                }
            }
            else if (row.Timber is not null)
                available = timber.GetValueOrDefault((product.Id, row.Timber));
            else
            {
                available = product.RetailUnit is null ? product.Stock : product.MeasureStock;
                if (inspections.Contains(product.Id)) reason = "Hay equipos en inspección";
            }
            if (!product.Active) { available = 0; reason = "Producto archivado"; }
            result.Add(new(product.Id, row.Timber, null, row.Quantity, available, reason, row.Lot));
        }
        return result.ToArray();
    }

    private async Task<List<StockCheck>> CheckSerialsAsync(Guid businessId, bool receiving, Dictionary<Guid, Product> products,
        StockLine[] lines, CancellationToken ct)
    {
        var series = lines.SelectMany(x => (x.Serials ?? []).Select(s => (x.ProductId, Key: RetailMeasures.SeriesKey(s))))
            .GroupBy(x => x.Key).ToArray();
        if (series.Length == 0) return [];
        var keys = series.Select(x => x.Key).ToArray();
        var units = await db.Set<EquipmentUnit>().AsNoTracking().Where(x => x.BusinessId == businessId && keys.Contains(x.Key))
            .Select(x => new { x.Key, x.ProductId, x.State }).ToDictionaryAsync(x => x.Key, ct);
        var result = new List<StockCheck>();
        foreach (var group in series)
        {
            units.TryGetValue(group.Key, out var unit);
            foreach (var selected in group.GroupBy(x => x.ProductId))
            {
                var product = products[selected.Key];
                if (product.WarrantyMonths is null) throw new CommerceFailure("Las series corresponden a equipos.");
                var reason = !product.Active ? "Producto archivado" : group.Count() > 1 ? "Serie repetida en el carrito" :
                    receiving ? (unit is null ? null : "Serie ya registrada") :
                    unit is null || unit.ProductId != product.Id ? "Serie no disponible para este producto" :
                    unit.State switch { "available" => null, "inspection" => "En inspección", "sold" => "Vendido", _ => "Serie no vendible" };
                result.Add(new(product.Id, null, group.Key, selected.Count(), reason is null ? 1 : 0, reason));
            }
        }
        return result;
    }

    private static StockDemand Prepare(StockLine line, Product product, string industry, bool quote)
    {
        var dimension = TimberInventory.Check(product, line.Timber);
        if (StoreProfiles.Retail(product) is { } profile)
        {
            var input = line.Measure ?? throw new CommerceFailure("Indica la unidad de " + product.Name + ".");
            var (quantity, _) = RetailMeasures.ForTrade(product, profile, input, industry, buying: false, quote, line.Tile);
            return new(product, null, quantity, input.Lot is null ? null : RetailInventory.LotCode(input.Lot));
        }
        if (line.Quantity is < 1 or > QuantityLimit || line.Measure is not null || line.Tile is not null)
            throw new CommerceFailure("Indica cantidades enteras válidas para " + product.Name + ".");
        return new(product, dimension, line.Quantity, null);
    }

    private async Task<ILookup<Guid, LotBalance>> ReadLotsAsync(Guid businessId, StockDemand[] requested, CancellationToken ct)
    {
        var ids = requested.Where(x => x.Product.TrackLots).Select(x => x.Product.Id).Distinct().ToArray();
        if (ids.Length == 0) return Array.Empty<LotBalance>().ToLookup(x => x.ProductId);
        var lotCodes = requested.Select(x => x.Lot).OfType<string>().Distinct().ToArray();
        var lots = RetailInventory.SellableLots(db.Set<RetailLot>().AsNoTracking()
            .Where(x => x.BusinessId == businessId && ids.Contains(x.ProductId) && x.Quantity > 0), Today);
        var balances = await lots.GroupBy(x => new { x.ProductId, Lot = lotCodes.Contains(x.Lot) ? x.Lot : null })
            .Select(group => new LotBalance(group.Key.ProductId, group.Key.Lot, group.Sum(x => x.Quantity))).ToArrayAsync(ct);
        return balances.ToLookup(x => x.ProductId);
    }

    private async Task<Dictionary<(Guid ProductId, TimberDimensions Timber), int>> ReadTimberAsync(
        Guid businessId, StockDemand[] requested, CancellationToken ct)
    {
        var rows = requested.Where(x => x.Timber is not null).ToArray();
        if (rows.Length == 0) return [];
        var ids = rows.Select(x => x.Product.Id).ToArray();
        var lengths = rows.Select(x => x.Timber!.LengthMicros).ToArray();
        var thicknesses = rows.Select(x => x.Timber!.ThicknessMicros).ToArray();
        var widths = rows.Select(x => x.Timber!.WidthMicros).ToArray();
        var balances = await db.Database.SqlQuery<TimberBalance>($"""
            SELECT stock."ProductId", stock."LengthMicros", stock."ThicknessMicros", stock."WidthMicros", stock."Stock"
            FROM unnest({ids}::uuid[], {lengths}::bigint[], {thicknesses}::bigint[], {widths}::bigint[])
                AS requested(product, length, thickness, width)
            JOIN khypupyme.timber_stock AS stock ON stock."BusinessId" = {businessId}
                AND stock."ProductId" = requested.product AND stock."LengthMicros" = requested.length
                AND stock."ThicknessMicros" = requested.thickness AND stock."WidthMicros" = requested.width
            """).ToArrayAsync(ct);
        return balances.ToDictionary(x => (x.ProductId, new TimberDimensions(x.LengthMicros, x.ThicknessMicros, x.WidthMicros)), x => x.Stock);
    }

    private sealed record StockDemand(Product Product, TimberDimensions? Timber, decimal Quantity, string? Lot);
    private sealed record LotBalance(Guid ProductId, string? Lot, decimal Quantity);
    private sealed record TimberBalance(Guid ProductId, long LengthMicros, long ThicknessMicros, long WidthMicros, int Stock);

    public async Task<CommercePage<WarehouseItem>> WarehouseAsync(string? search, string? status, string? attention,
        string? vehicleBrand, string? vehicleModel, int? year, int? page, CancellationToken ct)
    {
        var products = db.Set<Product>().AsNoTracking().Where(x => !x.IsService);
        if (attention is not null) products = store.AttentionProducts(products.Where(x => x.Active), attention);
        products = store.SearchProducts(store.FilterCompatibility(products, vehicleBrand, vehicleModel, year), search);

        var lots = RetailInventory.SellableLots(db.Set<RetailLot>().Where(x => x.Quantity > 0), Today);
        var inspections = db.Set<EquipmentUnit>().Where(x => x.State == "inspection");
        var availability = products.Select(p => new
        {
            Product = p,
            Sellable = p.RetailUnit == null ? p.Stock : !p.TrackLots ? p.MeasureStock :
                lots.Where(l => l.BusinessId == p.BusinessId && l.ProductId == p.Id).Sum(l => l.Quantity),
            Withheld = p.TrackLots && p.MeasureStock > 0 ||
                p.WarrantyMonths != null && inspections.Any(s => s.BusinessId == p.BusinessId && s.ProductId == p.Id),
        }).Select(x => new
        {
            x.Product,
            Status = !x.Product.Active ? "unavailable" : x.Sellable > 0 ? "available" : x.Withheld ? "unavailable" : "empty",
        });
        if (status is not null)
        {
            if (status is not ("available" or "empty" or "unavailable"))
                throw new CommerceFailure("Elige un estado válido de existencias.");
            availability = availability.Where(x => x.Status == status);
        }
        var pageIds = await CommerceReads.PageAsync(availability.OrderBy(x => x.Product.Name).ThenBy(x => x.Product.Id)
            .Select(x => new { x.Product.Id, x.Status }), page, ct);
        var ids = pageIds.Items.Select(x => x.Id).ToArray();
        var documents = await store.Describe(db.Set<Product>().AsNoTracking().Where(x => ids.Contains(x.Id)))
            .ToDictionaryAsync(x => x.Id, ct);
        return new(pageIds.Items.Select(x => new WarehouseItem(documents[x.Id], x.Status)).ToArray(), pageIds.HasMore);
    }

    public async Task<CommercePage<StockMovement>> MovementsAsync(Guid productId, int? page, CancellationToken ct)
    {
        if (!await db.Set<Product>().AnyAsync(x => x.Id == productId, ct))
            throw new CommerceFailure("El producto no está disponible en este negocio.", 404);
        var query = from line in db.Set<EntryLine>().AsNoTracking()
                    join entry in db.Set<Entry>().AsNoTracking() on new { line.BusinessId, Id = line.EntryId } equals new { entry.BusinessId, entry.Id }
                    where line.ProductId == productId && (entry.Kind == "purchase" || entry.Kind == "stock-in" ||
                        entry.Kind == "sale" || entry.Kind == "return" || entry.Kind == "exchange" || entry.Kind == "stock-loss" ||
                        entry.Kind == "inspection" || entry.Kind == "hold-lot" || entry.Kind == "release-lot" ||
                        entry.Kind == "discard-lot" || entry.Kind == "open-cement")
                    orderby entry.Sequence descending, line.LineId
                    select new { entry.Id, entry.Number, entry.Date, entry.Kind, entry.Note, line.Quantity, line.LengthMicros,
                        line.ThicknessMicros, line.WidthMicros, line.DetailsJson, line.Restocked };
        var rows = await CommerceReads.PageAsync(query, page, ct);
        return new(rows.Items.Select(x => new StockMovement(x.Id, x.Number, x.Date, x.Kind, x.Note, x.Quantity,
            x.LengthMicros is long length ? new(length, x.ThicknessMicros!.Value, x.WidthMicros!.Value) : null,
            LineDetails.Parse(x.DetailsJson), x.Restocked)).ToArray(), rows.HasMore);
    }
}
