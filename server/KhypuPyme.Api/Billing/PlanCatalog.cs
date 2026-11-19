namespace KhypuPyme.Api.Billing;

internal static class PlanCatalog
{
    internal sealed record Plan(string Id, string Name, long AmountMinor, int Days, int Months, int SavingMinor)
    {
        public PlanOption At(DateTimeOffset from) => new(Id, Name, AmountMinor, Days, Months, SavingMinor, End(from, Days, Months));
    }

    public static readonly Plan[] Plans =
    [
        new("30-days", "30 días", 3_900, 30, 0, 0),
        new("6-months", "6 meses", 21_000, 0, 6, 2_400),
        new("1-year", "1 año", 39_000, 0, 12, 7_800),
    ];

    public static readonly DemoCard[] Cards =
    [
        new("demo-visa", "Visa", "4242", "approved"),
        new("demo-mastercard", "Mastercard", "4444", "approved"),
        new("demo-declined", "Visa", "0002", "declined"),
    ];

    private static readonly TimeZoneInfo Bolivia = TimeZoneInfo.FindSystemTimeZoneById("America/La_Paz");

    public static DateTimeOffset End(DateTimeOffset from, int days, int months)
    {
        if (months == 0) return from.AddDays(days).ToUniversalTime();
        var local = TimeZoneInfo.ConvertTime(from, Bolivia).DateTime.AddMonths(months);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, Bolivia));
    }
}
