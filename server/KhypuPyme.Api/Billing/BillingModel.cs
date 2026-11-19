using KhypuPyme.Api.Businesses;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Billing;

internal static class BillingModel
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<AccountTrial>(entry =>
        {
            entry.ToTable("account_trials", table => table.HasCheckConstraint("trial_window",
                """ ("StartedAt" IS NULL AND "EndsAt" IS NULL) OR ("StartedAt" IS NOT NULL AND "EndsAt" IS NOT NULL AND "EndsAt" > "StartedAt") """));
            entry.HasKey(x => x.OwnerId);
            entry.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(x => x.OwnerId);
        });
        model.Entity<PaymentAttempt>(entry =>
        {
            entry.ToTable("demo_payments", table =>
            {
                table.HasCheckConstraint("demo_payment_state", """
                    "State" IN ('pending','approved','declined','cancelled','expired','refunded')
                    AND "TestResult" IN ('approved','declined') AND "CardLastFour" ~ '^[0-9]{4}$'
                    """);
                table.HasCheckConstraint("demo_payment_period", """
                    "AmountMinor" > 0 AND (("Days" > 0 AND "Months" = 0) OR ("Days" = 0 AND "Months" > 0))
                    AND (("State" IN ('approved','refunded') AND "PaidAt" IS NOT NULL AND "AccessFrom" IS NOT NULL
                          AND "AccessUntil" IS NOT NULL AND "AccessUntil" > "AccessFrom")
                      OR ("State" NOT IN ('approved','refunded') AND "PaidAt" IS NULL AND "AccessFrom" IS NULL AND "AccessUntil" IS NULL))
                    """);
            });
            entry.HasKey(x => new { x.BusinessId, x.Id });
            entry.HasIndex(x => x.BusinessId).IsUnique().HasFilter(""" "State" = 'pending' """);
            entry.HasIndex(x => new { x.OwnerId, x.BusinessId, x.CreatedAt });
            entry.HasOne<Business>().WithMany().HasPrincipalKey(x => new { x.OwnerId, x.Id }).HasForeignKey(x => new { x.OwnerId, Id = x.BusinessId });
        });
    }
}
