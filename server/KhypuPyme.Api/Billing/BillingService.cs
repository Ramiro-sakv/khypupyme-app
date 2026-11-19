using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Billing;

internal sealed class BillingService(KhypuPymeDbContext db, BusinessAccess access, LicenseAccess license, TimeProvider clock)
{
    private DateTimeOffset Now
    {
        get
        {
            var value = clock.GetUtcNow();
            return value.AddTicks(-(value.Ticks % TimeSpan.TicksPerMicrosecond));
        }
    }

    public async Task<PlanStatus> ReadAsync(Guid owner, Guid business, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, business, ct, System.Data.IsolationLevel.RepeatableRead);
        await RequireBusinessAsync(owner, business, ct);
        var now = Now;
        var trial = await TrialAsync(owner, ct);
        var payments = await license.Payments(owner, business).AsNoTracking().OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).ToArrayAsync(ct);
        var trialHere = trial?.FirstBusinessId == business ? trial : null;
        var approved = payments.Where(x => x.State == "approved").ToArray();
        var active = Active(trialHere, approved, now);
        var until = approved.Select(x => x.AccessUntil).Append(trialHere?.EndsAt).Max();
        var estimateFrom = active && until > now ? until.Value : now;
        return new(active, until, await EmailVerifiedAsync(owner, ct), trialHere is not null, trial?.StartedAt is not null,
            trialHere?.EndsAt, PlanCatalog.Plans.Select(plan => plan.At(estimateFrom)).ToArray(), PlanCatalog.Cards,
            payments.Select(row => Show(row, now)).ToArray());
    }

    public async Task ActivateTrialAsync(Guid owner, Guid business, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, business, ct);
        await access.LockBusinessAsync(business, ct);
        await RequireBusinessAsync(owner, business, ct);
        var trial = await TrialAsync(owner, ct);
        if (trial is null || trial.FirstBusinessId != business)
            throw new CommerceFailure("La prueba se puede activar en el primer negocio de la cuenta.", 409);
        if (trial.StartedAt is not null) return;
        if (!await EmailVerifiedAsync(owner, ct))
            throw new CommerceFailure("Verifica tu correo antes de activar la prueba.", 403);
        var now = Now;
        if (await license.Payments(owner, business).AnyAsync(x => x.State == "approved" && x.AccessUntil > now, ct))
            throw new CommerceFailure("Ya tienes vigencia. Podrás activar la prueba cuando termine.", 409);
        trial.StartedAt = now;
        trial.EndsAt = PlanCatalog.End(now, 30, 0);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<PaymentInfo> BeginAsync(Guid owner, Guid business, CheckoutInput input, CancellationToken ct)
    {
        if (input.Id == Guid.Empty) throw new CommerceFailure("Identifica el intento de pago.");
        var plan = PlanCatalog.Plans.SingleOrDefault(plan => plan.Id == input.PlanId)
            ?? throw new CommerceFailure("Elige un pase del catálogo.");
        var card = PlanCatalog.Cards.SingleOrDefault(card => card.Id == input.CardId)
            ?? throw new CommerceFailure("Elige una tarjeta de demostración.");
        await using var tx = await access.OpenAsync(owner, business, ct);
        await access.LockBusinessAsync(business, ct);
        await RequireBusinessAsync(owner, business, ct);
        var now = Now;
        var rows = license.Payments(owner, business);
        var old = await rows.SingleOrDefaultAsync(x => x.Id == input.Id, ct);
        if (old is not null)
        {
            EnsureSameSelection(old, input);
            return Show(old, now);
        }

        var pending = await rows.SingleOrDefaultAsync(x => x.State == "pending", ct);
        if (pending is not null)
        {
            if (pending.ExpiresAt > now)
            {
                EnsureSameSelection(pending, input);
                return Show(pending, now);
            }
            pending.State = "expired";
            await db.SaveChangesAsync(ct);
        }
        var row = new PaymentAttempt
        {
            OwnerId = owner, BusinessId = business, Id = input.Id, PlanId = plan.Id, PlanName = plan.Name,
            AmountMinor = plan.AmountMinor, Days = plan.Days, Months = plan.Months, CardId = card.Id, CardBrand = card.Brand,
            CardLastFour = card.LastFour, TestResult = card.TestResult, CreatedAt = now, ExpiresAt = now.AddMinutes(15)
        };
        db.Add(row);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Show(row, now);
    }

    public async Task<PaymentInfo> ChangeAsync(Guid owner, Guid business, Guid id, CheckoutAction input, CancellationToken ct)
    {
        if (input.Action is not ("confirm" or "cancel" or "expire" or "refund"))
            throw new CommerceFailure("Elige una acción de demostración disponible.");
        await using var tx = await access.OpenAsync(owner, business, ct);
        await access.LockBusinessAsync(business, ct);
        await RequireBusinessAsync(owner, business, ct);
        var rows = license.Payments(owner, business);
        var row = await rows.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new CommerceFailure("No se encontró ese intento de pago en el negocio.", 404);
        var now = Now;
        if (row.State == "pending" && row.ExpiresAt <= now) row.State = "expired";
        switch (input.Action)
        {
            case "confirm" when row.State == "pending":
                row.State = row.TestResult;
                if (row.State == "approved")
                {
                    var paidUntil = await rows.Where(x => x.State == "approved").MaxAsync(x => x.AccessUntil, ct);
                    var trial = await TrialAsync(owner, ct);
                    var trialUntil = trial?.FirstBusinessId == business ? trial.EndsAt : null;
                    var start = new[] { now, paidUntil ?? now, trialUntil ?? now }.Max();
                    row.PaidAt = now;
                    row.AccessFrom = start;
                    row.AccessUntil = PlanCatalog.End(start, row.Days, row.Months);
                }
                break;
            case "cancel" when row.State == "pending":
                row.State = "cancelled";
                break;
            case "expire" when row.State == "pending":
                row.State = "expired";
                row.ExpiresAt = now;
                break;
            case "refund" when row.State == "approved":
                await RefundAsync(rows, row, now, ct);
                break;
            case "refund" when row.State == "refunded":
            case "confirm" when row.State != "pending":
            case "cancel" when row.State is "cancelled" or "expired":
            case "expire" when row.State == "expired":
                break;
            default:
                throw new CommerceFailure("Ese intento ya cambió de estado. Consulta su resultado.", 409);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Show(row, now);
    }

    private static async Task RefundAsync(IQueryable<PaymentAttempt> rows, PaymentAttempt row, DateTimeOffset now, CancellationToken ct)
    {
        row.State = "refunded";
        if (row.AccessUntil <= now) return;
        var next = await rows.Where(x => x.Id != row.Id && x.State == "approved" && x.AccessFrom >= row.AccessUntil)
            .OrderBy(x => x.AccessFrom).ThenBy(x => x.Id).ToArrayAsync(ct);
        // Se retira el resto del pase reembolsado y se recolocan los pases aún sin usar.
        var cursor = row.AccessFrom > now ? row.AccessFrom.Value : now;
        foreach (var later in next)
        {
            later.AccessFrom = later.PaidAt > cursor ? later.PaidAt.Value : cursor;
            later.AccessUntil = PlanCatalog.End(later.AccessFrom.Value, later.Days, later.Months);
            cursor = later.AccessUntil.Value;
        }
    }

    private Task<AccountTrial?> TrialAsync(Guid owner, CancellationToken ct) =>
        db.Set<AccountTrial>().SingleOrDefaultAsync(x => x.OwnerId == owner, ct);

    private Task<bool> EmailVerifiedAsync(Guid owner, CancellationToken ct) =>
        db.Set<IdentityUser<Guid>>().AnyAsync(x => x.Id == owner && x.EmailConfirmed, ct);

    private async Task RequireBusinessAsync(Guid owner, Guid business, CancellationToken ct)
    {
        if (await access.ClosedAsync(owner, ct))
            throw new CommerceFailure("La cuenta tiene una solicitud de eliminación.", 403);
        if (!await access.VisibleBusinesses().AnyAsync(x => x.Id == business && x.OwnerId == owner && x.PracticeOriginId == null, ct))
            throw new CommerceFailure("No se encontró el negocio.", 404);
    }

    private static bool Active(AccountTrial? trial, PaymentAttempt[] paid, DateTimeOffset now) =>
        (trial is not null && trial.StartedAt <= now && trial.EndsAt > now) ||
        paid.Any(x => x.AccessFrom <= now && x.AccessUntil > now);

    private static void EnsureSameSelection(PaymentAttempt row, CheckoutInput input)
    {
        if (row.PlanId != input.PlanId || row.CardId != input.CardId)
            throw new CommerceFailure("Resuelve el intento pendiente antes de cambiar el pase o la tarjeta.", 409);
    }

    private static PaymentInfo Show(PaymentAttempt row, DateTimeOffset now) =>
        new(row.Id, row.PlanId, row.PlanName, row.AmountMinor, new(row.CardId, row.CardBrand, row.CardLastFour, row.TestResult),
            row.State == "pending" && row.ExpiresAt <= now ? "expired" : row.State, row.CreatedAt, row.ExpiresAt,
            row.PaidAt, row.AccessFrom, row.AccessUntil);
}
