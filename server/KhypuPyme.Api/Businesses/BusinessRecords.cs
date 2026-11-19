namespace KhypuPyme.Api.Businesses;

public sealed class Business
{
    public Guid Id { get; init; }
    public Guid OwnerId { get; init; }
    public Guid? PracticeOriginId { get; init; }
    public required string Name { get; init; }
    public required string Industry { get; init; }
    public required string CreationDigest { get; init; }
}

public sealed class BusinessSettings
{
    public Guid BusinessId { get; init; }
    public Guid OwnerId { get; init; }
    public required string City { get; set; }
    public required string Phone { get; set; }
    public string? TimberUnits { get; set; }
    public int PolicyRevision { get; set; }
    public string DefaultPayment { get; set; } = BusinessPolicy.DefaultPayment;
    public int MaxDiscountPercent { get; set; } = BusinessPolicy.MaxDiscountPercent;
    public int QuoteDays { get; set; } = BusinessPolicy.QuoteDays;
    public bool AllowNewCredit { get; set; } = true;
    public int LotAlertDays { get; set; } = BusinessPolicy.LotAlertDays;

    public OperatingPolicy Policy() => new(PolicyRevision, DefaultPayment, MaxDiscountPercent, QuoteDays, AllowNewCredit, LotAlertDays);
}

public sealed class AccountSelection
{
    public Guid OwnerId { get; init; }
    public Guid BusinessId { get; set; }
}

public sealed record IndustryOption(string Id, string Name, string Description);
public sealed record BusinessCard(Guid Id, string Name, string Industry);
public sealed record BusinessPage(BusinessCard[] Items, bool HasMore);
public sealed record SelectedBusiness(BusinessCard? Business);
public sealed record BusinessProfile(Guid Id, string Name, string Industry, string City, string Phone, string? TimberUnits, OperatingPolicy Policy);
public sealed record NewBusiness(Guid Id, string? Name, string? Industry, string? City, string? Phone, string? TimberUnits);
public sealed record SettingsInput(Guid BusinessId, string? City, string? Phone, string? TimberUnits);
