using System.Text.Json.Serialization;

namespace KhypuPyme.Api.Billing;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CheckoutInput(Guid Id, string PlanId, string CardId);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CheckoutAction(string Action);

public sealed record DemoCard(string Id, string Brand, string LastFour, string TestResult);
public sealed record PlanOption(string Id, string Name, long AmountMinor, int Days, int Months, int SavingMinor, DateTimeOffset EstimatedEnd);
public sealed record PaymentInfo(Guid Id, string PlanId, string PlanName, long AmountMinor, DemoCard Card, string State,
    DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? PaidAt, DateTimeOffset? AccessFrom, DateTimeOffset? AccessUntil);
public sealed record PlanStatus(bool Active, DateTimeOffset? AccessUntil, bool EmailVerified, bool FirstBusiness, bool TrialUsed,
    DateTimeOffset? TrialUntil, PlanOption[] Plans, DemoCard[] Cards, PaymentInfo[] Payments);

internal sealed class AccountTrial
{
    public Guid OwnerId { get; init; }
    public Guid FirstBusinessId { get; init; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
}

internal sealed class PaymentAttempt
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public Guid OwnerId { get; init; }
    public required string PlanId { get; init; }
    public required string PlanName { get; init; }
    public long AmountMinor { get; init; }
    public int Days { get; init; }
    public int Months { get; init; }
    public required string CardId { get; init; }
    public required string CardBrand { get; init; }
    public required string CardLastFour { get; init; }
    public required string TestResult { get; init; }
    public string State { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? AccessFrom { get; set; }
    public DateTimeOffset? AccessUntil { get; set; }
}
