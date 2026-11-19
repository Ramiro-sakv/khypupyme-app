using System.Text.Json.Serialization;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using KhypuPyme.Api.Businesses;

namespace KhypuPyme.Api.Commerce;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CommerceCommand(
    Guid OperationId, string Kind, Guid? EntityId = null, Guid? CustomerId = null, Guid? SourceId = null,
    string? Name = null, string? Code = null, string? Phone = null, string? Method = null, string? Note = null,
    long? AmountMinor = null, long? DiscountMinor = null, bool? Active = null, CommandLine[]? Lines = null,
    TimberPrices? TimberProduct = null,
    RetailProfile? RetailProduct = null, ApparelProfile? ApparelProduct = null, EquipmentProfile? EquipmentProduct = null,
    CommandLine[]? ExchangeLines = null, string? Serial = null, bool? Release = null,
    CosmeticProfile? CosmeticProduct = null, ContainerInput[]? Containers = null, int? StockQuantity = null,
    ProductDetail? DetailProduct = null, PartsProfile? PartsProduct = null, PrintingProfile? PrintingProduct = null,
    FurnitureDimensions? FurnitureProduct = null, TileProfile? TileProduct = null, CementSetup? CementProduct = null, DeliveryInput? Delivery = null,
    bool? ServiceProduct = null, WorkInput? Work = null, WorkRevision? WorkLink = null, string? WorkState = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] VariantInput[]? Variants = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] OperatingPolicyInput? Policy = null);

public sealed record VariantInput(Guid Id, string? Code, string Size, string Color, long AmountMinor);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CommandLine(Guid ProductId, int Quantity, long? UnitMinor = null, bool? Restock = null,
    TimberDimensions? Timber = null, Guid? OriginalLineId = null, RetailInput? Measure = null, string[]? Serials = null,
    PrintingInput? Printing = null, TileRequest? Tile = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? TimberRateManual = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TimberCostUnit = null);
public sealed record CommandResult(Guid OperationId, string Kind, Guid EntityId);

public sealed record CommercePage<T>(T[] Items, bool HasMore);
public sealed record ProductInfo(Guid Id, string Name, string Code, long PriceMinor, int Stock, long ValueMinor, bool Active, TimberPrices? Timber,
    RetailProfile? Retail, ApparelProfile? Apparel, EquipmentProfile? Equipment, decimal? MeasuredStock, decimal? SellableStock,
    CosmeticProfile? Cosmetic, ProductSpecialty? Specialty, bool IsService);
public sealed record CustomerInfo(Guid Id, string Name, string Phone, string? Code = null);
public sealed record CashInfo(Guid Id, DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt,
    long OpeningMinor, long ExpectedMinor, long? CountedMinor);
public sealed record CashStatus(CashInfo? Session);
public sealed record SetupStatus(bool CashStarted, bool CatalogReady, bool Sold);
public sealed record ReceivableInfo(Guid SaleId, string Number, DateOnly Date, string CustomerName, long OriginalMinor, long BalanceMinor,
    bool Manual, bool Voided);

public sealed record EntryInfo(Guid Id, string Number, string Kind, DateOnly Date, string? Method, string? CustomerName,
    long TotalMinor, long CashDeltaMinor, Guid? SourceId, bool Linked);
public sealed record EntryDocument(Guid Id, string Number, string Kind, DateOnly Date, DateOnly? ExpiresOn,
    string BusinessName, Guid? CustomerId, string? CustomerName, string? Method, string Note,
    long TotalMinor, long DiscountMinor, long CashDeltaMinor, long DebtDeltaMinor, Guid? SourceId,
    bool Linked, DocumentLine[] Lines, string? TimberUnits, bool Practice, long DebtBalanceMinor, ContainerMovementInfo[] Containers,
    DeliveryInfo? Delivery, WorkCharge? Work);
public sealed record DocumentLine(Guid ProductId, string Name, string Code, int Quantity, long UnitMinor,
    long SubtotalMinor, long CostMinor, bool? Restocked, int ReturnedQuantity,
    Guid LineId, string? Species, TimberDimensions? Timber, LineDetails? Details, decimal ReturnedBaseQuantity);

public sealed record ResultDay(DateOnly Date, long SalesMinor, long CostMinor, long PurchasesMinor, long ExpensesMinor, long LossesMinor)
{
    public long ResultMinor => SalesMinor - CostMinor - ExpensesMinor - LossesMinor;
}
public sealed record CommerceReport(DateOnly From, DateOnly To, ResultDay Totals, ResultDay[] Days, long StockValueMinor, long ReceivablesMinor);
