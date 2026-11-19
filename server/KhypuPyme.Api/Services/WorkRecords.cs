using System.Text.Json;
using System.Text.Json.Serialization;
using KhypuPyme.Api.Commerce;

namespace KhypuPyme.Api.Services;

public sealed record WorkInput(string Title, DateOnly Day, Guid? ServiceId = null, int? StartMinute = null, int? Duration = null,
    long? BudgetMinor = null, string? Address = null, WorkDetails? Details = null);

public sealed record WorkDetails(string? Tasks = null, string? PlannedMaterials = null, string? UsedMaterials = null,
    string? Deliverables = null, string? Equipment = null, string? Accessories = null, string? Fault = null,
    string? Diagnosis = null, string? Specifications = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? BillableMaterials = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? InternalMaterials = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? StatusNote = null)
{
    internal static WorkDetails Read(string json) => JsonSerializer.Deserialize<WorkDetails>(json)!;
}

public sealed record WorkRevision(Guid Id, int Revision);
public sealed record WorkCharge(Guid Id, string Title);
public sealed record WorkAttention(int Today, int Overdue, int ReadyToCharge, int Upcoming, int WaitingParts);
public sealed record WorkInfo(Guid Id, string Title, string Industry, Guid CustomerId, string CustomerName, Guid? ServiceId,
    DateOnly Day, int? StartMinute, int? Duration, long? BudgetMinor, string? Address, WorkDetails Details,
    string State, int Revision, Guid? SaleId, Guid? ReceiptId, DateOnly? DeliveredOn);

internal sealed class WorkItem : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public required string Industry { get; init; }
    public required string Title { get; set; }
    public Guid CustomerId { get; set; }
    public Guid? ServiceId { get; set; }
    public DateOnly Day { get; set; }
    public int? StartMinute { get; set; }
    public int? Duration { get; set; }
    public long? BudgetMinor { get; set; }
    public string? Address { get; set; }
    public required string DetailsJson { get; set; }
    public required string State { get; set; }
    public int Revision { get; set; }
    public Guid? SaleId { get; set; }
    public Guid? ReceiptId { get; set; }
    public DateOnly? DeliveredOn { get; set; }
}
