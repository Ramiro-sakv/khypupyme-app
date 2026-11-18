using System.Numerics;
using KhypuPyme.Api.Commerce;

namespace KhypuPyme.Api.Timber;

// Micrómetros escalados a milésimas: 1 mm = 1.000.000. El volumen nunca pasa por punto flotante.
public sealed record TimberDimensions(long LengthMicros, long ThicknessMicros, long WidthMicros);
public sealed record TimberPrices(string Species, long SuperShortMinor, long ShortMinor, long LongMinor);
public sealed record TimberStockInfo(TimberDimensions Timber, int Stock, long ValueMinor);

internal sealed class TimberStock : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid ProductId { get; init; }
    public long LengthMicros { get; init; }
    public long ThicknessMicros { get; init; }
    public long WidthMicros { get; init; }
    public int Stock { get; set; }
    public long ValueMinor { get; set; }
}

internal static class TimberMeasures
{
    public const long Foot = 304_800_000;
    private const long Maximum = 10_000_000_000;
    private static readonly BigInteger BoardFoot = 2_359_737_216L * BigInteger.Pow(10, 15);

    public static void Validate(TimberDimensions dimensions)
    {
        if (dimensions.LengthMicros < Foot || dimensions.LengthMicros > 20 * Foot || dimensions.LengthMicros % Foot != 0)
            throw new CommerceFailure("El largo debe equivaler a un número entero de 1 a 20 pies.");
        if (dimensions.ThicknessMicros is <= 0 or > Maximum || dimensions.WidthMicros is <= 0 or > Maximum)
            throw new CommerceFailure("El espesor y el ancho deben ser positivos y de hasta 10.000 mm.");
    }

    public static long Rate(Product product, TimberDimensions dimensions) => (dimensions.LengthMicros / Foot) switch
    {
        <= 2 => product.SuperShortMinor!.Value,
        <= 6 => product.ShortMinor!.Value,
        _ => product.LongMinor!.Value,
    };

    public static BigInteger Volume(TimberDimensions dimensions, int quantity) =>
        (BigInteger)dimensions.LengthMicros * dimensions.ThicknessMicros * dimensions.WidthMicros * quantity;

    public static long Total(BigInteger volume, long rate)
    {
        var numerator = volume * rate;
        var rounded = (numerator * 2 + BoardFoot) / (BoardFoot * 2);
        if (rounded > CommerceRules.Limit) throw new CommerceFailure("El subtotal de madera supera el límite.");
        return (long)rounded;
    }

    public static string Describe(TimberDimensions d) =>
        $"{d.LengthMicros / Foot}′ ({d.LengthMicros / 1_000_000m:0.######} mm) · "
        + $"{Face(d.ThicknessMicros)} de espesor · {Face(d.WidthMicros)} de ancho";

    private static string Face(long micrometres) =>
        $"{micrometres / 25_400_000m:0.##}″ ({micrometres / 1_000_000m:0.######} mm)";
}
