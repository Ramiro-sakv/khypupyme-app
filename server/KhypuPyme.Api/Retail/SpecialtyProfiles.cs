using System.Text.Json;
using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

public sealed record ProductDetail(string Reference, string Measure, string Shelf, string Brand = "", string Model = "");
public sealed record VehicleFitment(string Brand, string Model, int FromYear, int ToYear, bool Confirmed);
public sealed record PartsProfile(string[] Equivalents, VehicleFitment[] Compatibility);
public sealed record PrintingProfile(string PaperSize, string Color);
public sealed record PrintingInput(int Copies, int FacesPerCopy, bool Duplex);
public sealed record PrintingDetail(PrintingProfile Profile, PrintingInput Job, int Faces, int Sheets);
public sealed record ProductSpecialty(ProductDetail? Detail, PartsProfile? Parts, PrintingProfile? Printing, string? CountUnit, MaterialProfile? Material = null);

internal sealed class PartReference : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid ProductId { get; init; }
    public required string Key { get; init; }
    public required string Reference { get; init; }
}

internal sealed class ProductFitment : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid ProductId { get; init; }
    public int Position { get; init; }
    public required string Brand { get; init; }
    public required string Model { get; init; }
    public required string BrandKey { get; init; }
    public required string ModelKey { get; init; }
    public int FromYear { get; init; }
    public int ToYear { get; init; }
    public bool Confirmed { get; init; }
}

internal static class SpecialtyProfiles
{
    public static bool HasVariants(string industry) => industry is "clothing" or "footwear";
    public static bool HasEquipment(string industry) => industry is "appliances" or "electronics";

    public static ProductSpecialty? Read(Product product) =>
        product.DetailJson is null && product.PartsJson is null && product.PrintingSize is null && product.CountUnit is null && product.MaterialJson is null ? null :
        new(Parse<ProductDetail>(product.DetailJson), Parse<PartsProfile>(product.PartsJson),
            product.PrintingSize is null ? null : new(product.PrintingSize, product.PrintingColor!), product.CountUnit, MaterialProfiles.Read(product));

    private static T? Parse<T>(string? json) where T : class =>
        json is null ? null : JsonSerializer.Deserialize<T>(json);

    public static async Task SaveAsync(CommerceTransaction work, Product product)
    {
        var input = work.Command;
        var industry = work.Business.Industry;
        if (input.DetailProduct is { } detail)
        {
            if (industry is not ("hardware" or "spareParts" or "electronics"))
                throw new CommerceFailure("La ficha técnica no corresponde a este rubro.");
            var normalized = new ProductDetail(Text(detail.Reference, 80, "la referencia"), Text(detail.Measure, 80, "la medida"),
                Text(detail.Shelf, 60, "el estante"), Text(detail.Brand, 80, "la marca"), Text(detail.Model, 80, "el modelo"));
            product.DetailJson = JsonSerializer.Serialize(normalized);
            product.Reference = normalized.Reference;
            product.MeasureLabel = normalized.Measure;
            product.Shelf = normalized.Shelf;
            product.DetailBrand = normalized.Brand;
            product.DetailModel = normalized.Model;
        }
        if (input.PartsProduct is { } parts)
        {
            if (industry != "spareParts" || parts.Equivalents is null || parts.Compatibility is null ||
                parts.Equivalents.Length > 30 || parts.Compatibility.Length > 30)
                throw new CommerceFailure("La ficha admite hasta 30 referencias y 30 compatibilidades declaradas.");
            var references = parts.Equivalents.Select(x => Text(x, 80, "la referencia equivalente", true)).ToArray();
            if (references.Select(x => x.ToUpperInvariant()).Distinct().Count() != references.Length)
                throw new CommerceFailure("Cada referencia equivalente debe ser distinta.");
            var fitments = parts.Compatibility.Select(x => Normalize(x)).ToArray();
            if (fitments.Select(x => (x.Brand.ToUpperInvariant(), x.Model.ToUpperInvariant(), x.FromYear, x.ToYear)).Distinct().Count() != fitments.Length)
                throw new CommerceFailure("La compatibilidad declarada aparece repetida.");
            await work.Db.Set<PartReference>().Where(x => x.ProductId == product.Id).ExecuteDeleteAsync(work.Ct);
            await work.Db.Set<ProductFitment>().Where(x => x.ProductId == product.Id).ExecuteDeleteAsync(work.Ct);
            for (int i = 0; i < fitments.Length; i++)
            {
                var row = fitments[i];
                work.Db.Add(new ProductFitment { BusinessId = product.BusinessId, ProductId = product.Id, Position = i,
                    Brand = row.Brand, Model = row.Model, BrandKey = row.Brand.ToUpperInvariant(), ModelKey = row.Model.ToUpperInvariant(),
                    FromYear = row.FromYear, ToYear = row.ToYear, Confirmed = row.Confirmed });
            }
            foreach (var reference in references)
                work.Db.Add(new PartReference { BusinessId = product.BusinessId, ProductId = product.Id, Key = reference.ToUpperInvariant(), Reference = reference });
            product.PartsJson = JsonSerializer.Serialize(new PartsProfile(references, fitments));
        }
        if (input.PrintingProduct is { } printing)
        {
            if (industry != "stationery" || printing.Color is not ("bw" or "color"))
                throw new CommerceFailure("Elige blanco y negro o color para el servicio de impresión.");
            if (input.EntityId is not null && product.PrintingSize is null)
                throw new CommerceFailure("Crea una ficha de servicio para configurar la impresión.");
            var size = Text(printing.PaperSize, 40, "el tamaño de impresión", true);
            if (input.EntityId is not null && (size != product.PrintingSize || printing.Color != product.PrintingColor))
                throw new CommerceFailure("Crea otra tarifa para cambiar el tamaño o el color.");
            if (input.RetailProduct is not null || input.ApparelProduct is not null || input.EquipmentProduct is not null)
                throw new CommerceFailure("Configura la impresión en su propia ficha de servicio.");
            product.PrintingSize = size;
            product.PrintingColor = printing.Color;
        }
        else if (product.PrintingSize is not null)
            throw new CommerceFailure("Conserva la configuración del servicio de impresión.");
        if (industry == "footwear" && product.Model is not null) product.CountUnit = "pair";
    }

    private static VehicleFitment Normalize(VehicleFitment? row)
    {
        if (row is null || row.FromYear is < 1900 or > 2200 || row.ToYear < row.FromYear || row.ToYear > 2200)
            throw new CommerceFailure("Indica un rango de años válido entre 1900 y 2200.");
        return row with { Brand = Text(row.Brand, 80, "la marca del vehículo", true), Model = Text(row.Model, 80, "el modelo del vehículo", true) };
    }

    public static PrintingDetail Printing(Product product, PrintingInput? input, bool selling)
    {
        if (product.PrintingSize is null || !selling || input is null || input.Copies is < 1 or > 1_000_000 ||
            input.FacesPerCopy is < 1 or > 1_000_000 || (long)input.Copies * input.FacesPerCopy > 1_000_000)
            throw new CommerceFailure("La impresión admite de 1 a 1.000.000 de caras. Indica copias y caras por copia.");
        var faces = input.Copies * input.FacesPerCopy;
        var sheets = input.Copies * (input.Duplex ? (input.FacesPerCopy + 1) / 2 : input.FacesPerCopy);
        return new PrintingDetail(new(product.PrintingSize, product.PrintingColor!), input, faces, sheets);
    }
}
