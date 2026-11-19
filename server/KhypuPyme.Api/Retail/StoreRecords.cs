using System.Text.Json;
using System.Text.Json.Serialization;
using KhypuPyme.Api.Commerce;

namespace KhypuPyme.Api.Retail;

public sealed record RetailProfile(string Unit, int BoxSize, bool TrackLots, decimal Reorder, decimal? RollLength = null);
public sealed record ApparelProfile(string Model, string Size, string Color);
public sealed record EquipmentProfile(int WarrantyMonths);
public sealed record RetailInput(string Quantity, string Unit, string? Lot = null, DateOnly? ExpiresOn = null, int? Loose = null);
public sealed record CosmeticProfile(string Brand, string Presentation, string? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? AfterOpeningMonths = null);
public sealed record LotAllocation(string Lot, DateOnly? ExpiresOn, decimal Quantity, long CostMinor);
public sealed record LineDetails(RetailInput? Measure = null, decimal? BaseQuantity = null,
    LotAllocation[]? Lots = null, ApparelProfile? Apparel = null, string? Serial = null, DateOnly? WarrantyUntil = null,
    string? Direction = null, string? RateUnit = null, ProductSpecialty? Specialty = null, PrintingDetail? Printing = null, TileCoverage? Tile = null,
    bool IsService = false, long? TimberCatalogMinor = null, string? TimberCostUnit = null)
{
    internal static LineDetails? Parse(string? json) => json is null ? null : JsonSerializer.Deserialize<LineDetails>(json);
    internal static string? Save(LineDetails? value) => value is null ? null : JsonSerializer.Serialize(value);
}

public sealed record LotInfo(string Lot, DateOnly? ExpiresOn, decimal Quantity, bool Sellable, bool Held, long ValueMinor);
public sealed record SerialInfo(string Serial, Guid ProductId, string ProductName, string State, DateOnly? WarrantyUntil);
public sealed record SerialMovement(string Kind, Guid EntryId, string Number, DateOnly Date, string Note, DateOnly? WarrantyUntil,
    Guid? SourceId);
public sealed record UnitHistory(SerialInfo Unit, SerialMovement[] Movements);
public sealed record StoreAttention(int Reorder, int Expiring, int Inspections, int Expired, int Held);

internal sealed class RetailLot : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid ProductId { get; init; }
    public required string Lot { get; init; }
    public DateOnly? ExpiresOn { get; init; }
    public decimal Quantity { get; set; }
    public long ValueMinor { get; set; }
    public bool Held { get; set; }
}

internal sealed class EquipmentUnit : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid ProductId { get; init; }
    public required string Key { get; init; }
    public required string Serial { get; init; }
    public required string State { get; set; }
    public Guid? SaleId { get; set; }
    public long CostMinor { get; set; }
    public DateOnly? WarrantyUntil { get; set; }
}

internal sealed class EquipmentMovement : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid EntryId { get; init; }
    public required string SerialKey { get; init; }
    public required string Kind { get; init; }
    public DateOnly? WarrantyUntil { get; init; }
}
