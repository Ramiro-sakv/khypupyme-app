using System.Globalization;
using System.Numerics;
using System.Text.RegularExpressions;
using KhypuPyme.Api.Commerce;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal static partial class RetailMeasures
{
    public const decimal MaxBase = 1_000_000_000m;
    [GeneratedRegex(@"^\d{1,7}(?:[.,]\d{1,3})?$", RegexOptions.CultureInvariant)]
    private static partial Regex QuantityPattern();

    public static decimal Quantity(string? raw, bool allowZero = false)
    {
        if (raw is null || !QuantityPattern().IsMatch(raw) ||
            !decimal.TryParse(raw.Replace(',', '.'), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)
            || amount < (allowZero ? 0 : 0.001m) || amount > QuantityLimit)
            throw new CommerceFailure("Indica una cantidad positiva con hasta tres decimales.");
        return amount;
    }

    public static decimal Factor(string unit, RetailProfile profile, bool buying) => unit switch
    {
        "piece" when profile.Unit == "piece" => 1m,
        "box" when buying && profile.Unit == "piece" && profile.BoxSize > 1 => profile.BoxSize,
        "g" when profile.Unit is "g" or "kg" or "lb" => 1m,
        "kg" when profile.Unit is "g" or "kg" or "lb" => 1000m,
        "lb" when profile.Unit is "g" or "kg" or "lb" => 453.59237m,
        "ml" when profile.Unit is "ml" or "l" => 1m,
        "l" when profile.Unit is "ml" or "l" => 1000m,
        "m" when profile.Unit == "m" => 1m,
        "roll" when buying && profile.Unit == "m" && profile.RollLength is > 0 => profile.RollLength.Value,
        _ => throw new CommerceFailure("La unidad elegida no corresponde a este producto."),
    };

    public static (decimal Captured, decimal Base) Convert(RetailInput input, RetailProfile profile, bool buying, bool mixed = false, bool boxSale = false)
    {
        if (input.Loose is int loose && (!mixed || input.Unit != "box" || loose is < 0 or > QuantityLimit))
            throw new CommerceFailure("Indica unidades sueltas enteras solamente junto a cajas de bebidas.");
        var captured = Quantity(input.Quantity, allowZero: input.Loose is > 0);
        var factor = Factor(input.Unit, profile, buying || mixed || boxSale);
        if ((profile.Unit == "piece" || input.Unit == "roll") && captured != decimal.Truncate(captured))
            throw new CommerceFailure("Las cajas, unidades y rollos se registran en cantidades enteras.");
        var stored = captured * factor + (input.Loose ?? 0);
        if (stored > MaxBase || profile.Unit == "piece" && stored > QuantityLimit)
            throw new CommerceFailure("La cantidad convertida supera el límite de existencias.");
        return (captured, stored);
    }

    public static (decimal Quantity, TileCoverage? Coverage) ForTrade(Product product, RetailProfile profile,
        RetailInput input, string industry, bool buying, bool quote, TileRequest? selection)
    {
        var tile = buying ? null : MaterialProfiles.Read(product)?.Tile;
        if (selection is not null && tile is null)
            throw new CommerceFailure("La cobertura corresponde a una ficha de cerámicas en venta o cotización.");
        if (!buying && (input.ExpiresOn is not null ||
            input.Lot is not null && (!profile.TrackLots || industry != "pets" || quote)))
            throw new CommerceFailure("Los lotes vendibles se asignan al confirmar la venta.");
        var quantity = Convert(input, profile, buying, mixed: industry == "beverages", boxSale: tile is not null).Base;
        var coverage = tile is null ? null : MaterialProfiles.CalculateTile(tile, selection, input.Unit, (int)quantity, profile.BoxSize);
        return (quantity, coverage);
    }

    public static long Proportion(long amount, decimal from, decimal to, decimal whole)
    {
        if (whole == 0) return 0;
        var denominator = Scaled(whole);
        return (long)(Round(amount * Scaled(to), denominator) - Round(amount * Scaled(from), denominator));
    }

    public static long Subtotal(long unitMinor, decimal quantity, decimal priceFactor)
    {
        var total = Round(unitMinor * Scaled(quantity), Scaled(priceFactor));
        if (total > Limit) throw new CommerceFailure("El subtotal supera el límite.");
        return (long)total;
    }

    // Las capturas admiten tres decimales y la libra aporta otros cinco.
    private static BigInteger Scaled(decimal value) => new(value * 100_000_000m);
    private static BigInteger Round(BigInteger numerator, BigInteger denominator) =>
        (numerator * 2 + denominator) / (denominator * 2);

    public static string SeriesKey(string? raw) =>
        Text(Text(raw, 80, "el número de serie", true).ToUpperInvariant(), 80, "el número de serie", true);
}
