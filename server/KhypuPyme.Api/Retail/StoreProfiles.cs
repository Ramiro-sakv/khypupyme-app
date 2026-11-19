using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal static class StoreProfiles
{
    public static bool IsRetail(string industry) => industry is "convenience" or "grocery" or "beverages" or "cosmetics" or "pets" or "hardware" or "ceramics" or "cement";
    public static RetailProfile? Retail(Product product) => product.RetailUnit is null ? null :
        new(product.RetailUnit, product.BoxSize, product.TrackLots, product.Reorder, product.RollLength);
    public static ApparelProfile? Apparel(Product product) => product.Model is null ? null : new(product.Model, product.Size!, product.Color!);

    public static async Task SaveAsync(CommerceTransaction work, Product product)
    {
        var command = work.Command;
        if (command.RetailProduct is { } retail && IsRetail(work.Business.Industry))
        {
            var factor = RetailMeasures.Factor(retail.Unit, retail, false);
            if ((work.Business.Industry is "ceramics" or "cement") && retail.Unit != "piece")
                throw new CommerceFailure("Configura el inventario por piezas o bolsas en este rubro.");
            if (retail.Unit == "m" && (work.Business.Industry != "hardware" || retail.RollLength is not > 0 or > 100_000 ||
                decimal.Round(retail.RollLength.Value, 3) != retail.RollLength.Value) ||
                retail.Unit != "m" && retail.RollLength is not null ||
                work.Business.Industry == "hardware" && retail.Unit is not ("piece" or "m"))
                throw new CommerceFailure("Habilita metros con un largo de rollo positivo de hasta 100.000 m, con hasta tres decimales.");
            if (!retail.TrackLots && (work.Business.Industry == "cosmetics" ||
                work.Business.Industry == "pets" && retail.Unit is "g" or "kg" or "lb"))
                throw new CommerceFailure("Habilita lotes para conservar el origen de este producto.");
            if (retail.BoxSize is < 1 or > 100_000 || retail.Unit != "piece" && retail.BoxSize != 1 ||
                retail.Reorder is < 0 or > RetailMeasures.MaxBase || retail.Reorder * factor > RetailMeasures.MaxBase ||
                decimal.Round(retail.Reorder, 3) != retail.Reorder ||
                retail.Unit == "piece" && decimal.Truncate(retail.Reorder) != retail.Reorder)
                throw new CommerceFailure("Revisa la presentación y el mínimo de reposición.");
            if (command.EntityId is not null && (product.RetailUnit != retail.Unit || product.TrackLots != retail.TrackLots ||
                product.BoxSize != retail.BoxSize || product.RollLength != retail.RollLength))
                throw new CommerceFailure("La unidad de precio, la equivalencia de caja y el control de lotes se fijan al crear la ficha.");
            product.RetailUnit = retail.Unit;
            product.BoxSize = retail.BoxSize;
            product.TrackLots = retail.TrackLots;
            product.Reorder = retail.Reorder * factor;
            product.RollLength = retail.RollLength;
        }
        else if (command.RetailProduct is not null || product.RetailUnit is not null)
            throw new CommerceFailure("Esta ficha de tienda requiere su configuración de existencias.");

        if (command.CosmeticProduct is { } cosmetic && work.Business.Industry == "cosmetics" && product.RetailUnit is not null)
        {
            product.Brand = Text(cosmetic.Brand, 80, "la marca", true);
            product.Presentation = Text(cosmetic.Presentation, 80, "la presentación", true);
            product.Tone = Text(cosmetic.Tone, 60, "el tono");
            if (cosmetic.AfterOpeningMonths is int months)
            {
                if (months is < 0 or > 120)
                    throw new CommerceFailure("Indica una duración tras apertura entre 1 y 120 meses.");
                product.AfterOpeningMonths = months == 0 ? null : months;
            }
        }
        else if (command.CosmeticProduct is not null || product.Brand is not null || work.Business.Industry == "cosmetics" && product.RetailUnit is not null)
            throw new CommerceFailure("Indica la marca y presentación de la ficha de cosméticos.");

        if (command.ApparelProduct is { } apparel && SpecialtyProfiles.HasVariants(work.Business.Industry))
        {
            var model = Text(apparel.Model, 80, "el modelo", true);
            var size = Text(apparel.Size, 24, "la talla", true);
            var color = Text(apparel.Color, 40, "el color", true);
            var key = model.ToUpperInvariant();
            var variant = string.Join('\u001f', key, size.ToUpperInvariant(), color.ToUpperInvariant());
            var existing = work.Db.Set<Product>().Where(x => x.ModelKey == key && x.Id != product.Id);
            var staged = work.Db.Set<Product>().Local.Where(x => x.BusinessId == work.Business.Id && x.ModelKey == key && x.Id != product.Id &&
                work.Db.Entry(x).State == EntityState.Added).ToArray();
            if (command.EntityId is not null && product.VariantKey != variant)
                throw new CommerceFailure("Crea otra variante para cambiar su modelo, talla o color.");
            if (staged.Any(x => x.VariantKey == variant) || await existing.AnyAsync(x => x.VariantKey == variant, work.Ct))
                throw new CommerceFailure("Ese modelo ya tiene una variante con esta talla y color.", 409);
            if (command.EntityId is null && staged.Length + await existing.CountAsync(work.Ct) >= 100)
                throw new CommerceFailure("El modelo admite hasta 100 variantes.");
            product.Model = model;
            product.ModelKey = key;
            product.Size = size;
            product.Color = color;
            product.VariantKey = variant;
        }
        else if (command.ApparelProduct is not null || product.Model is not null)
            throw new CommerceFailure("Esta ficha requiere la variante de ropa.");

        if (command.EquipmentProduct is { } equipment && SpecialtyProfiles.HasEquipment(work.Business.Industry))
        {
            if (equipment.WarrantyMonths is < 0 or > 120)
                throw new CommerceFailure("La garantía admite de 0 a 120 meses.");
            if (command.EntityId is not null && product.WarrantyMonths is null)
                throw new CommerceFailure("Crea otra ficha para empezar a identificar equipos por serie.");
            product.WarrantyMonths = equipment.WarrantyMonths;
        }
        else if (command.EquipmentProduct is not null || product.WarrantyMonths is not null)
            throw new CommerceFailure("Esta ficha de equipo requiere los meses de garantía.");
    }
}
