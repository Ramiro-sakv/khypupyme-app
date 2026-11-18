namespace KhypuPyme.Api.Commerce;

internal interface IBusinessRecord { Guid BusinessId { get; } }

internal sealed class Product : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public required string Name { get; set; }
    public required string Code { get; set; }
    public string NormalizedCode { get; set; } = "";
    public long PriceMinor { get; set; }
    public int Stock { get; set; }
    public long ValueMinor { get; set; }
    public bool Active { get; set; } = true;
}

internal sealed class Customer : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public required string Name { get; set; }
    public string Phone { get; set; } = "";
}

internal sealed class CashSession : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public DateTimeOffset OpenedAt { get; init; }
    public DateTimeOffset? ClosedAt { get; set; }
    public long OpeningMinor { get; init; }
    public long ExpectedMinor { get; set; }
    public long? CountedMinor { get; set; }
}

internal sealed class Entry : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public Guid? CustomerId { get; set; }
    public Guid? CashSessionId { get; set; }
    public Guid? SourceId { get; set; }
    public long Sequence { get; init; }
    public required string Number { get; init; }
    public required string BusinessName { get; init; }
    public string? CustomerName { get; set; }
    public required string Kind { get; init; }
    public required DateOnly Date { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateOnly? ExpiresOn { get; set; }
    public string? Method { get; set; }
    public string Note { get; set; } = "";
    public long TotalMinor { get; set; }
    public long DiscountMinor { get; set; }
    public long CashDeltaMinor { get; set; }
    public long SalesMinor { get; set; }
    public long CostMinor { get; set; }
    public long PurchasesMinor { get; set; }
    public long ExpensesMinor { get; set; }
    public long LossesMinor { get; set; }
    public long DebtDeltaMinor { get; set; }
    public List<EntryLine> Lines { get; } = [];
}

internal sealed class EntryLine : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid EntryId { get; init; }
    public Guid ProductId { get; init; }
    public required string Name { get; init; }
    public required string Code { get; init; }
    public int Quantity { get; init; }
    public long UnitMinor { get; init; }
    public long SubtotalMinor { get; init; }
    public long CostMinor { get; init; }
    public bool? Restocked { get; init; }
}

internal sealed class Receivable : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid SaleId { get; init; }
    public Guid CustomerId { get; init; }
    public long OriginalMinor { get; init; }
    public long BalanceMinor { get; set; }
}

internal sealed class CommerceReceipt
{
    public Guid AccountId { get; init; }
    public Guid Id { get; init; }
    public Guid BusinessId { get; init; }
    public required string Kind { get; init; }
    public required string Digest { get; init; }
    public Guid EntityId { get; init; }
}
