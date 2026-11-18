using System.Linq.Expressions;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Timber;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal sealed class StoreReads(KhypuPymeDbContext db, TimeProvider clock)
{
    private DateOnly Today => LocalDate(clock.GetUtcNow());

    public IQueryable<ProductInfo> Describe(IQueryable<Product> products)
    {
        var today = Today;
        var lots = db.Set<RetailLot>().AsNoTracking().Where(lot => lot.ExpiresOn == null || lot.ExpiresOn >= today);
        return products.Select(x => new ProductInfo(x.Id, x.Name, x.Code, x.PriceMinor, x.Stock, x.ValueMinor, x.Active,
            x.Species == null ? null : new TimberPrices(x.Species, x.SuperShortMinor!.Value, x.ShortMinor!.Value, x.LongMinor!.Value),
            x.RetailUnit == null ? null : new RetailProfile(x.RetailUnit, x.BoxSize, x.TrackLots,
                x.Reorder / (x.RetailUnit == "kg" || x.RetailUnit == "l" ? 1000m : x.RetailUnit == "lb" ? 453.59237m : 1m)),
            x.Model == null ? null : new ApparelProfile(x.Model, x.Size!, x.Color!),
            x.WarrantyMonths == null ? null : new EquipmentProfile(x.WarrantyMonths.Value), x.RetailUnit == null ? null : x.MeasureStock,
            x.RetailUnit == null ? null : !x.TrackLots ? x.MeasureStock :
                lots.Where(lot => lot.ProductId == x.Id && lot.BusinessId == x.BusinessId).Sum(lot => lot.Quantity)));
    }

    public Task<ProductInfo?> CodeAsync(string? code, CancellationToken ct)
    {
        var key = Text(Text(code, 40, "el código", true).ToUpperInvariant(), 40, "el código", true);
        return Describe(db.Set<Product>().AsNoTracking().Where(x => x.Active && x.NormalizedCode == key)).SingleOrDefaultAsync(ct);
    }

    public Task<ProductInfo[]> VariantsAsync(string? model, CancellationToken ct)
    {
        var key = Text(model, 80, "el modelo", true).ToUpperInvariant();
        return Describe(db.Set<Product>().AsNoTracking().Where(x => x.Active && x.ModelKey == key)
            .OrderBy(x => x.Size).ThenBy(x => x.Color)).ToArrayAsync(ct);
    }

    public Task<CommercePage<LotInfo>> LotsAsync(Guid product, int? page, CancellationToken ct)
    {
        var today = Today;
        return CommerceReads.PageAsync(db.Set<RetailLot>().AsNoTracking().Where(x => x.ProductId == product && x.Quantity > 0)
            .OrderBy(x => x.ExpiresOn == null).ThenBy(x => x.ExpiresOn).ThenBy(x => x.Lot)
            .Select(x => new LotInfo(x.Lot, x.ExpiresOn, x.Quantity, x.ExpiresOn == null || x.ExpiresOn >= today)), page, ct);
    }

    public Task<CommercePage<SerialInfo>> SerialsAsync(Guid? product, string? search, string? state, int? page, CancellationToken ct)
    {
        var serials = db.Set<EquipmentUnit>().AsNoTracking();
        if (product is not null) serials = serials.Where(x => x.ProductId == product);
        if (state is not null)
        {
            if (state is not ("available" or "sold" or "inspection" or "discarded"))
                throw new CommerceFailure("Elige un estado válido.");
            serials = serials.Where(x => x.State == state);
        }
        var term = CommerceReads.Search(search);
        if (term is not null) serials = serials.Where(x => EF.Functions.ILike(x.Serial, term, "\\"));
        return CommerceReads.PageAsync(DescribeUnits(serials.OrderBy(x => x.Key)), page, ct, 100);
    }

    public async Task<UnitHistory?> SerialAsync(string? serial, CancellationToken ct)
    {
        var key = RetailMeasures.SeriesKey(serial);
        var unit = await DescribeUnits(db.Set<EquipmentUnit>().AsNoTracking().Where(x => x.Key == key)).SingleOrDefaultAsync(ct);
        if (unit is null) return null;
        var history = await (from movement in db.Set<EquipmentMovement>().AsNoTracking()
                             join entry in db.Set<Entry>().AsNoTracking() on new { movement.BusinessId, Id = movement.EntryId }
                                equals new { entry.BusinessId, entry.Id }
                             where movement.SerialKey == key
                             orderby entry.Sequence descending
                             select new SerialMovement(movement.Kind, entry.Id, entry.Number, entry.Date, entry.Note, movement.WarrantyUntil))
            .ToArrayAsync(ct);
        return new UnitHistory(unit, history);
    }

    public async Task<StoreAttention> AttentionAsync(CancellationToken ct)
    {
        var today = Today;
        var end = today.AddDays(30);
        var products = db.Set<Product>().AsNoTracking().Where(x => x.Active);
        var lots = db.Set<RetailLot>().AsNoTracking().Where(x => x.Quantity > 0);
        var reorder = await products.Where(AtReorder(today, lots)).CountAsync(ct);
        var expiring = await lots.CountAsync(x => x.ExpiresOn >= today && x.ExpiresOn <= end &&
            products.Any(p => p.Id == x.ProductId && p.BusinessId == x.BusinessId), ct);
        var inspections = await db.Set<EquipmentUnit>().CountAsync(x => x.State == "inspection", ct);
        return new StoreAttention(reorder, expiring, inspections);
    }

    public IQueryable<Product> AttentionProducts(IQueryable<Product> products, string attention)
    {
        var today = Today;
        var end = today.AddDays(30);
        var lots = db.Set<RetailLot>().AsNoTracking().Where(x => x.Quantity > 0);
        return attention switch
        {
            "reorder" => products.Where(AtReorder(today, lots)),
            "expiring" => products.Where(p => lots.Any(x => x.ProductId == p.Id && x.BusinessId == p.BusinessId && x.ExpiresOn >= today && x.ExpiresOn <= end)),
            _ => throw new CommerceFailure("Elige reposición o próximos vencimientos."),
        };
    }

    private static Expression<Func<Product, bool>> AtReorder(DateOnly today, IQueryable<RetailLot> lots) =>
        p => p.RetailUnit != null && (p.TrackLots ?
            lots.Where(x => x.ProductId == p.Id && x.BusinessId == p.BusinessId && (x.ExpiresOn == null || x.ExpiresOn >= today))
                .Sum(x => x.Quantity) : p.MeasureStock) <= p.Reorder;

    private IQueryable<SerialInfo> DescribeUnits(IQueryable<EquipmentUnit> units) =>
        from unit in units
        join product in db.Set<Product>().AsNoTracking() on new { unit.BusinessId, Id = unit.ProductId }
            equals new { product.BusinessId, product.Id }
        select new SerialInfo(unit.Serial, product.Id, product.Name, unit.State, unit.WarrantyUntil);
}
