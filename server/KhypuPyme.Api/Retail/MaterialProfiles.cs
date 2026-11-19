using System.Globalization;
using System.Text.Json;
using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

public sealed record FurnitureDimensions(decimal WidthCm, decimal DepthCm, decimal HeightCm);
public sealed record TileProfile(decimal BoxArea, string? Tone, string? Caliber);
public sealed record TileRequest(string? Area, string? Waste, string? Tone, string? Caliber);
public sealed record TileCoverage(TileRequest Request, decimal DeliveredArea, decimal? RequiredArea);
public sealed record CementSetup(decimal BagKg, long? BulkPriceMinor);
public sealed record CementProfile(decimal BagKg, long? BulkPriceMinor, Guid? BulkProductId, bool IsBulk = false);
public sealed record MaterialProfile(FurnitureDimensions? Furniture = null, TileProfile? Tile = null, CementProfile? Cement = null);

internal static class MaterialProfiles
{
    public static MaterialProfile? Read(Product product) =>
        product.MaterialJson is null ? null : JsonSerializer.Deserialize<MaterialProfile>(product.MaterialJson);

    public static async Task SaveAsync(CommerceTransaction work, Product product)
    {
        var input = work.Command;
        var current = Read(product);
        if (product.CementSourceId is not null)
            throw new CommerceFailure("Edita la tarifa a granel desde la ficha de bolsas.");
        if (input.FurnitureProduct is { } furniture && work.Business.Industry == "furniture")
        {
            if (!Positive(furniture.WidthCm) || !Positive(furniture.DepthCm) || !Positive(furniture.HeightCm))
                throw new CommerceFailure("Ancho, fondo y alto deben ser positivos y de hasta 100.000 cm.");
            Write(product, new(Furniture: furniture));
        }
        else if (input.TileProduct is { } tile && work.Business.Industry == "ceramics")
        {
            if (!Positive(tile.BoxArea) || product.RetailUnit != "piece" || product.BoxSize <= 1)
                throw new CommerceFailure("Configura piezas por caja y una cobertura positiva en m² por caja.");
            if (current?.Tile is { } prior && prior.BoxArea != tile.BoxArea)
                throw new CommerceFailure("Crea otra ficha para cambiar la cobertura de la caja.");
            var normalized = tile with { Tone = Text(tile.Tone, 60, "el tono"), Caliber = Text(tile.Caliber, 60, "el calibre") };
            if (current?.Tile is { } previous && (previous.Tone != normalized.Tone || previous.Caliber != normalized.Caliber))
                throw new CommerceFailure("Crea otra ficha para cambiar el tono o calibre.");
            Write(product, new(Tile: normalized));
        }
        else if (input.CementProduct is { } cement && work.Business.Industry == "cement")
        {
            if (!Positive(cement.BagKg) || product.RetailUnit != "piece" || product.BoxSize != 1 || !product.TrackLots)
                throw new CommerceFailure("Indica el peso por bolsa y usa control por lotes.");
            if (current?.Cement is { } prior && prior.BagKg != cement.BagKg)
                throw new CommerceFailure("Crea otra ficha para cambiar el peso de una bolsa.");
            Guid? bulkId = current?.Cement?.BulkProductId;
            if (cement.BulkPriceMinor is long price)
            {
                Money(price, "una tarifa por kg");
                Product bulk;
                if (bulkId is Guid id) bulk = await work.ProductAsync(id);
                else
                {
                    bulkId = Guid.NewGuid();
                    var code = $"GR-{bulkId:N}";
                    bulk = new Product { BusinessId = product.BusinessId, Id = bulkId.Value, Name = product.Name,
                        Code = code, NormalizedCode = code, RetailUnit = "kg", BoxSize = 1, TrackLots = true, CementSourceId = product.Id };
                    work.Db.Add(bulk);
                }
                bulk.Name = product.Name[..Math.Min(88, product.Name.Length)] + " · granel";
                bulk.PriceMinor = price;
                bulk.Active = product.Active;
                Write(bulk, new(Cement: new(cement.BagKg, null, null, IsBulk: true)));
            }
            else if (bulkId is not null) throw new CommerceFailure("Conserva la tarifa del formato a granel habilitado.");
            Write(product, new(Cement: new(cement.BagKg, cement.BulkPriceMinor, bulkId)));
        }
        else if (input.FurnitureProduct is not null || input.TileProduct is not null || input.CementProduct is not null)
            throw new CommerceFailure("La configuración de materiales no corresponde a esta ficha.");
        else if (product.RetailUnit is not null && work.Business.Industry is ("ceramics" or "cement"))
            throw new CommerceFailure("Indica la cobertura por caja de la cerámica o el peso por bolsa del cemento, según el rubro.");
    }

    private static bool Positive(decimal value) => value is > 0 and <= 100_000m && decimal.Round(value, 3) == value;

    private static void Write(Product product, MaterialProfile material) => product.MaterialJson = JsonSerializer.Serialize(material);

    public static TileCoverage CalculateTile(TileProfile tile, TileRequest? selection, string unit, int pieces, int boxSize)
    {
        selection ??= new(null, null, null, null);
        var tone = Text(selection.Tone, 60, "el tono");
        var caliber = Text(selection.Caliber, 60, "el calibre");
        if (tone != (tile.Tone ?? "") || caliber != (tile.Caliber ?? ""))
            throw new CommerceFailure("Selecciona el tono y calibre de la ficha de cerámica.");
        decimal? required = null;
        if (!string.IsNullOrWhiteSpace(selection.Area))
        {
            var area = RetailMeasures.Quantity(selection.Area.Trim());
            var waste = string.IsNullOrWhiteSpace(selection.Waste) ? 0 : RetailMeasures.Quantity(selection.Waste.Trim(), allowZero: true);
            if (waste > 100) throw new CommerceFailure("La merma debe estar entre 0 y 100 %.");
            required = area * (100 + waste) / 100;
            var minimum = unit == "box"
                ? decimal.Ceiling(required.Value / tile.BoxArea) * boxSize
                : decimal.Ceiling(required.Value * boxSize / tile.BoxArea);
            if (minimum != pieces) throw new CommerceFailure("La cantidad cambió. Recalcula la cobertura y revisa el carrito.");
            selection = selection with { Area = area.ToString(CultureInfo.InvariantCulture), Waste = waste.ToString(CultureInfo.InvariantCulture) };
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(selection.Waste)) throw new CommerceFailure("Indica el área para aplicar merma.");
            selection = selection with { Area = null, Waste = null };
        }
        return new(selection with { Tone = tone, Caliber = caliber }, pieces * tile.BoxArea / boxSize, required);
    }
}
