using System.Text.Json.Serialization;
using KhypuPyme.Api.Timber;

namespace KhypuPyme.Api.Commerce;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CommerceCommand(
    Guid OperationId, string Kind, Guid? EntityId = null, Guid? CustomerId = null, Guid? SourceId = null,
    string? Name = null, string? Code = null, string? Phone = null, string? Method = null, string? Note = null,
    long? AmountMinor = null, long? DiscountMinor = null, bool? Active = null, CommandLine[]? Lines = null,
    TimberPrices? TimberProduct = null);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CommandLine(Guid ProductId, int Quantity, long? UnitMinor = null, bool? Restock = null,
    TimberDimensions? Timber = null, Guid? OriginalLineId = null);
public sealed record CommandResult(Guid OperationId, string Kind, Guid EntityId);

public sealed record CommercePage<T>(T[] Items, bool HasMore);
public sealed record ProductInfo(Guid Id, string Name, string Code, long PriceMinor, int Stock, long ValueMinor, bool Active, TimberPrices? Timber);
public sealed record CustomerInfo(Guid Id, string Name, string Phone);
public sealed record CashInfo(Guid Id, DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt,
    long OpeningMinor, long ExpectedMinor, long? CountedMinor);
public sealed record CashStatus(CashInfo? Session);
public sealed record ReceivableInfo(Guid SaleId, string Number, DateOnly Date, string CustomerName, long OriginalMinor, long BalanceMinor);

public sealed record EntryInfo(Guid Id, string Number, string Kind, DateOnly Date, string? Method, string? CustomerName,
    long TotalMinor, long CashDeltaMinor, Guid? SourceId, bool Linked);
public sealed record EntryDocument(Guid Id, string Number, string Kind, DateOnly Date, DateOnly? ExpiresOn,
    string BusinessName, Guid? CustomerId, string? CustomerName, string? Method, string Note,
    long TotalMinor, long DiscountMinor, long CashDeltaMinor, long DebtDeltaMinor, Guid? SourceId,
    bool Linked, DocumentLine[] Lines, string? TimberUnits, bool Practice);
public sealed record DocumentLine(Guid ProductId, string Name, string Code, int Quantity, long UnitMinor,
    long SubtotalMinor, long CostMinor, bool? Restocked, int ReturnedQuantity,
    Guid LineId, string? Species, TimberDimensions? Timber);

public sealed record ResultDay(DateOnly Date, long SalesMinor, long CostMinor, long PurchasesMinor, long ExpensesMinor, long LossesMinor)
{
    public long ResultMinor => SalesMinor - CostMinor - ExpensesMinor - LossesMinor;
}
public sealed record CommerceReport(DateOnly From, DateOnly To, ResultDay Totals, ResultDay[] Days, long StockValueMinor, long ReceivablesMinor);
