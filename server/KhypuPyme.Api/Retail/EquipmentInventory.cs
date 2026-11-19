using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

internal sealed class EquipmentInventory(CommerceTransaction work)
{
    private readonly HashSet<string> touched = new(StringComparer.Ordinal);
    private DbSet<EquipmentUnit> Units => work.Db.Set<EquipmentUnit>();

    public string[] Validate(Product product, CommandLine line, bool required)
    {
        if (product.WarrantyMonths is null)
        {
            if (line.Serials is not null) throw new CommerceFailure("Esta ficha no identifica unidades por serie.");
            return [];
        }
        if (!required && line.Serials is null) return [];
        if (line.Serials is not { Length: >= 1 and <= 100 } || line.Serials.Length != line.Quantity)
            throw new CommerceFailure("Indica una serie distinta para cada equipo.");
        var keys = line.Serials.Select(RetailMeasures.SeriesKey).ToArray();
        if (keys.Any(key => !touched.Add(key)))
            throw new CommerceFailure("Una serie aparece repetida en la operación.", 409);
        if (touched.Count > 100) throw new CommerceFailure("Divide la operación en hasta 100 series.");
        return line.Serials.Select(x => x.Trim()).ToArray();
    }

    public async Task BuyAsync(Product product, string serial, long cost, Entry entry)
    {
        var key = RetailMeasures.SeriesKey(serial);
        if (await Units.FindAsync([product.BusinessId, key], work.Ct) is not null)
            throw new CommerceFailure($"La serie {serial} ya está registrada en este negocio.", 409);
        var unit = new EquipmentUnit { BusinessId = product.BusinessId, ProductId = product.Id, Key = key,
            Serial = serial, State = "available", CostMinor = cost };
        Units.Add(unit);
        AddStock(product, 1, cost);
        Log(unit, entry, "purchase");
    }

    public async Task<EquipmentUnit> SellAsync(Product product, string serial, Entry entry)
    {
        var unit = await FindAsync(serial);
        if (unit.ProductId != product.Id || unit.State != "available")
            throw new CommerceFailure($"{product.Name} · Serie {serial}: sin stock para esta serie. Elige otra serie disponible.", 409);
        product.Stock--;
        product.ValueMinor -= unit.CostMinor;
        unit.State = "sold";
        unit.SaleId = entry.Id;
        unit.WarrantyUntil = product.WarrantyMonths is > 0 ? work.Today.AddMonths(product.WarrantyMonths.Value) : null;
        Log(unit, entry, "sale");
        return unit;
    }

    public async Task RefundAsync(Product product, string serial, Entry origin, Entry entry, bool inspect)
    {
        var unit = await FindAsync(serial);
        if (unit.ProductId != product.Id || unit.State != "sold" || unit.SaleId != origin.Id)
            throw new CommerceFailure("La serie ya fue devuelta o no corresponde a la venta original.", 409);
        unit.State = inspect ? "inspection" : "discarded";
        Log(unit, entry, "return");
    }

    public async Task<Guid> InspectAsync()
    {
        if (!SpecialtyProfiles.HasEquipment(work.Business.Industry) || work.Command.Release is not bool release)
            throw new CommerceFailure("Selecciona un resultado válido para la inspección.");
        var unit = await FindAsync(work.Command.Serial);
        if (unit.State != "inspection")
            throw new CommerceFailure("Solo se puede resolver una unidad pendiente de inspección.", 409);
        var entry = await work.NewEntryAsync("INS");
        entry.SourceId = unit.SaleId;
        entry.Note = Text(work.Command.Note, 240, "el resultado de la inspección", true);
        var product = await work.ProductAsync(unit.ProductId);
        unit.State = release ? "available" : "discarded";
        if (release) AddStock(product, 1, unit.CostMinor);
        else entry.LossesMinor = entry.TotalMinor = unit.CostMinor;
        Log(unit, entry, release ? "released" : "discarded");
        entry.Lines.Add(new EntryLine
        {
            BusinessId = entry.BusinessId, EntryId = entry.Id, ProductId = product.Id,
            Name = product.Name, Code = product.Code, Quantity = 1, CostMinor = unit.CostMinor,
            SubtotalMinor = entry.TotalMinor, Restocked = release,
            DetailsJson = LineDetails.Save(new(Serial: unit.Serial, WarrantyUntil: unit.WarrantyUntil)),
        });
        return entry.Id;
    }

    public async Task<Guid> WarrantyAsync()
    {
        if (!SpecialtyProfiles.HasEquipment(work.Business.Industry) || work.Command.Code is not ("open" or "resolved"))
            throw new CommerceFailure("Selecciona un estado de garantía válido.");
        var serial = await FindAsync(work.Command.Serial);
        var sale = await work.SourceAsync("sale");
        var records = work.Db.Set<EquipmentMovement>().Where(item => item.SerialKey == serial.Key);
        var original = await records.SingleOrDefaultAsync(item => item.EntryId == sale.Id && item.Kind == "sale", work.Ct)
            ?? throw new CommerceFailure("La serie no corresponde a esa venta.", 404);
        var state = work.Command.Code == "open" ? "warranty-open" : "warranty-resolved";
        var previous = await (from movement in records
                              join claim in work.Db.Set<Entry>() on new { movement.BusinessId, Id = movement.EntryId }
                                  equals new { claim.BusinessId, claim.Id }
                              where claim.SourceId == sale.Id && claim.Kind == "warranty"
                              orderby claim.Sequence descending
                              select movement.Kind).FirstOrDefaultAsync(work.Ct);
        if (previous == state || (state == "warranty-resolved" && previous != "warranty-open"))
            throw new CommerceFailure("Consulta el último estado del reclamo antes de actualizarlo.", 409);
        var entry = await work.NewEntryAsync("GAR");
        entry.SourceId = sale.Id;
        entry.Note = Text(work.Command.Note, 240, state == "warranty-open" ? "el motivo del reclamo" : "la resolución del reclamo", true);
        entry.CustomerId = sale.CustomerId;
        entry.CustomerName = sale.CustomerName;
        work.Db.Add(new EquipmentMovement
        {
            BusinessId = serial.BusinessId, SerialKey = serial.Key, EntryId = entry.Id, Kind = state, WarrantyUntil = original.WarrantyUntil,
        });
        return entry.Id;
    }

    private async Task<EquipmentUnit> FindAsync(string? serial) =>
        await Units.FindAsync([work.Business.Id, RetailMeasures.SeriesKey(serial)], work.Ct)
        ?? throw new CommerceFailure("La serie no está registrada en este negocio.", 404);

    private void Log(EquipmentUnit unit, Entry entry, string kind) =>
        work.Db.Add(new EquipmentMovement { BusinessId = unit.BusinessId, SerialKey = unit.Key, EntryId = entry.Id,
            Kind = kind, WarrantyUntil = unit.WarrantyUntil });
}
