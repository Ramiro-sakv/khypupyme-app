using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Timber;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

public sealed record StockRequest(StockLine[] Lines, bool Receiving = false);
public sealed record StockLine(Guid ProductId, int Quantity, TimberDimensions? Timber = null, RetailInput? Measure = null, string[]? Serials = null);
public sealed record StockCheck(Guid ProductId, TimberDimensions? Timber, string? Serial, decimal Requested, decimal Available, string? Reason);
public sealed record WarehouseItem(ProductInfo Product, string Status);
public sealed record StockMovement(Guid EntryId, string Number, DateOnly Date, string Kind, string Note, int Quantity,
    TimberDimensions? Timber, LineDetails? Details, bool? Restocked);

internal sealed class StockReads(KhypuPymeDbContext db, StoreReads store, TimeProvider clock)
{
    private DateOnly Today => LocalDate(clock.GetUtcNow());

    public async Task<StockCheck[]> CheckAsync(StockRequest request, CancellationToken ct)
    {
        if (request.Lines is not { Length: >= 1 and <= 100 } lines || lines.Any(x => x is null || x.Serials?.Length > 100))
            throw new CommerceFailure("Indica de 1 a 100 líneas para consultar el almacén.");
        var ids = lines.Select(x => x.ProductId).Distinct().ToArray();
        if (lines.Select(x => (x.ProductId, x.Timber?.LengthMicros, x.Timber?.ThicknessMicros)).Distinct().Count() > 20 ||
            lines.Sum(x => x.Serials?.Length ?? 0) > 100)
            throw new CommerceFailure("Se admiten 20 grupos y 100 series por operación.");

        var products = await db.Set<Product>().AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        if (products.Count != ids.Length) throw new CommerceFailure("Un producto no está disponible en este negocio.", 404);
        var series = lines.SelectMany(x => (x.Serials ?? []).Select(s => (x.ProductId, Key: RetailMeasures.SeriesKey(s))))
            .GroupBy(x => x.Key).ToArray();
        var keys = series.Select(x => x.Key).ToArray();
        var units = await db.Set<EquipmentUnit>().AsNoTracking().Where(x => keys.Contains(x.Key)).ToDictionaryAsync(x => x.Key, ct);
        var result = new List<StockCheck>();
        foreach (var group in series)
        {
            units.TryGetValue(group.Key, out var unit);
            foreach (var selected in group.GroupBy(x => x.ProductId))
            {
                var product = products[selected.Key];
                if (product.WarrantyMonths is null) throw new CommerceFailure("Las series corresponden a equipos.");
                var reason = !product.Active ? "Producto archivado" : group.Count() > 1 ? "Serie repetida en el carrito" :
                    request.Receiving ? (unit is null ? null : "Serie ya registrada") :
                    unit is null || unit.ProductId != product.Id ? "Serie no disponible para este producto" :
                    unit.State switch { "available" => null, "inspection" => "En inspección", "sold" => "Vendido", _ => "Serie no vendible" };
                result.Add(new(product.Id, null, group.Key, selected.Count(), reason is null ? 1 : 0, reason));
            }
        }
        if (request.Receiving) return result.ToArray();

        var today = Today;
        var lots = db.Set<RetailLot>().AsNoTracking().Where(x => !x.Held && (x.ExpiresOn == null || x.ExpiresOn >= today));
        foreach (var group in lines.Where(x => x.Serials is not { Length: > 0 } && !products[x.ProductId].IsService)
                     .GroupBy(x => (x.ProductId, x.Timber)))
        {
            var product = products[group.Key.ProductId];
            var dimension = TimberInventory.Check(product, group.Key.Timber);
            decimal requested, available;
            string? reason = null;
            if (StoreProfiles.Retail(product) is { } profile)
            {
                requested = group.Sum(x => RetailMeasures.Convert(x.Measure ??
                    throw new CommerceFailure("Indica la unidad de " + product.Name + "."), profile, buying: false).Base);
                available = profile.TrackLots ? await lots.Where(x => x.ProductId == product.Id).SumAsync(x => x.Quantity, ct) : product.MeasureStock;
                if (available < requested && profile.TrackLots && product.MeasureStock > available) reason = "Hay existencias vencidas o apartadas";
            }
            else
            {
                if (group.Any(x => x.Quantity is < 1 or > QuantityLimit || x.Measure is not null))
                    throw new CommerceFailure("Indica cantidades enteras válidas para " + product.Name + ".");
                requested = group.Sum(x => (decimal)x.Quantity);
                available = dimension is null ? product.Stock : await db.Set<TimberStock>().AsNoTracking()
                    .Where(x => x.ProductId == product.Id && x.LengthMicros == dimension.LengthMicros &&
                        x.ThicknessMicros == dimension.ThicknessMicros && x.WidthMicros == dimension.WidthMicros)
                    .Select(x => x.Stock).SingleOrDefaultAsync(ct);
                if (product.WarrantyMonths is not null && available < requested && await db.Set<EquipmentUnit>()
                    .AnyAsync(x => x.ProductId == product.Id && x.State == "inspection", ct))
                    reason = "Hay equipos en inspección";
            }
            if (!product.Active) { available = 0; reason = "Producto archivado"; }
            result.Add(new(product.Id, dimension, null, requested, available, reason));
        }
        return result.ToArray();
    }

    public async Task<CommercePage<WarehouseItem>> WarehouseAsync(string? search, string? status, string? attention, int? page, CancellationToken ct)
    {
        var products = db.Set<Product>().AsNoTracking().Where(x => !x.IsService);
        if (attention is not null) products = store.AttentionProducts(products.Where(x => x.Active), attention);
        var term = CommerceReads.Search(search);
        if (term is not null) products = products.Where(x => EF.Functions.ILike(x.Name, term, "\\") ||
            EF.Functions.ILike(x.Code, term, "\\") || x.Species != null && EF.Functions.ILike(x.Species, term, "\\") ||
            x.Model != null && EF.Functions.ILike(x.Model, term, "\\"));

        var today = Today;
        var lots = db.Set<RetailLot>().Where(x => x.Quantity > 0);
        var inspections = db.Set<EquipmentUnit>().Where(x => x.State == "inspection");
        var availability = products.Select(p => new
        {
            Product = p,
            Sellable = p.RetailUnit == null ? p.Stock : !p.TrackLots ? p.MeasureStock :
                lots.Where(l => l.ProductId == p.Id && !l.Held && (l.ExpiresOn == null || l.ExpiresOn >= today)).Sum(l => l.Quantity),
            Withheld = p.TrackLots && p.MeasureStock > 0 || p.WarrantyMonths != null && inspections.Any(s => s.ProductId == p.Id),
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
        var documents = await store.Describe(products.Where(x => ids.Contains(x.Id))).ToDictionaryAsync(x => x.Id, ct);
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
                        entry.Kind == "inspection" || entry.Kind == "hold-lot" || entry.Kind == "release-lot" || entry.Kind == "discard-lot")
                    orderby entry.Sequence descending, line.LineId
                    select new { entry.Id, entry.Number, entry.Date, entry.Kind, entry.Note, line.Quantity, line.LengthMicros,
                        line.ThicknessMicros, line.WidthMicros, line.DetailsJson, line.Restocked };
        var rows = await CommerceReads.PageAsync(query, page, ct);
        return new(rows.Items.Select(x => new StockMovement(x.Id, x.Number, x.Date, x.Kind, x.Note, x.Quantity,
            x.LengthMicros is long length ? new(length, x.ThicknessMicros!.Value, x.WidthMicros!.Value) : null,
            LineDetails.Parse(x.DetailsJson), x.Restocked)).ToArray(), rows.HasMore);
    }
}
