using KhypuPyme.Api.Commerce;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Timber;

internal sealed class TimberInventory(CommerceTransaction work)
{
    private async ValueTask<TimberStock?> FindAsync(Product product, TimberDimensions d) =>
        await work.Db.Set<TimberStock>().FindAsync([product.BusinessId, product.Id, d.LengthMicros, d.ThicknessMicros, d.WidthMicros], work.Ct);

    public async Task AddAsync(Product product, TimberDimensions? dimension, int count, long value)
    {
        AddStock(product, count, value);
        if (dimension is null) return;
        var balance = await FindAsync(product, dimension);
        if (balance is null)
        {
            balance = new TimberStock
            {
                BusinessId = product.BusinessId, ProductId = product.Id, LengthMicros = dimension.LengthMicros,
                ThicknessMicros = dimension.ThicknessMicros, WidthMicros = dimension.WidthMicros,
            };
            work.Db.Add(balance);
        }
        balance.Stock += count;
        balance.ValueMinor += value;
    }

    public async Task<long> RemoveAsync(Product product, TimberDimensions? dimension, int count)
    {
        if (dimension is null) return RemoveStock(product, count);
        var balance = await FindAsync(product, dimension);
        var available = balance?.Stock ?? 0;
        if (balance is null || count > available)
            throw new CommerceFailure($"{product.Name} · {product.Species} · {TimberMeasures.Describe(dimension)}. Pediste {count}, disponibles {available}, faltan {count - available} piezas.", 409);
        var cost = Share(balance.ValueMinor, 0, count, available);
        balance.Stock -= count;
        balance.ValueMinor -= cost;
        product.Stock -= count;
        product.ValueMinor -= cost;
        return cost;
    }

    public static TimberDimensions? Check(Product product, TimberDimensions? dimension)
    {
        if (product.Species is null && dimension is null) return null;
        if (product.Species is null || dimension is null)
            throw new CommerceFailure("Selecciona las medidas de la ficha de madera correspondiente.");
        TimberMeasures.Validate(dimension);
        return dimension;
    }

    public static void SetProfile(Product product, TimberPrices? prices, bool canUseTimber, bool isNew)
    {
        if (prices is null && product.Species is null) return;
        if (!canUseTimber || prices is null || (!isNew && product.Species is null))
            throw new CommerceFailure("Crea una ficha nueva para la madera por medidas. Las fichas existentes conservan su modelo.");
        product.Species = Text(prices.Species, 100, "la especie de madera", required: true);
        product.SuperShortMinor = Money(prices.SuperShortMinor, "la tarifa supercorta");
        product.ShortMinor = Money(prices.ShortMinor, "la tarifa corta");
        product.LongMinor = Money(prices.LongMinor, "la tarifa larga");
    }
}
