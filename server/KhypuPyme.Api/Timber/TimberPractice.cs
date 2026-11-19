using System.Data;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Billing;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Timber;

internal sealed class TimberPractice
{
    public Guid OwnerId { get; init; }
    public Guid OriginId { get; init; }
    public Guid? SandboxId { get; set; }
    public int Step { get; set; }
    public int Revision { get; set; }
    public required string State { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed record PracticeInfo(Guid? SandboxId, int Step, int Revision, string State, string? TimberUnits);
public sealed record PracticeStatus(PracticeInfo? Session);
public sealed record PracticeInput(string Action, int? Revision);
internal sealed class PracticeCommerce;

internal static class PracticeSteps
{
    public const int Reports = 5;
    public const int Done = 7;

    public static void Advance(TimberPractice practice, CommerceTransaction work)
    {
        var command = work.Command;
        var next = practice.Step switch
        {
            0 => command.Kind == "open-cash",
            1 => command.Kind == "product" && command.TimberProduct is not null && command.EntityId is null,
            2 => command.Kind == "purchase" && command.Lines?.Any(x => x.Timber is not null) == true,
            3 => command.Kind == "sale" && command.Lines?.Any(x => x.Timber is not null) == true,
            4 => command.Kind == "return" && work.Db.Set<Entry>().Local.Single(x => x.Id == command.OperationId)
                .Lines.Any(x => x.LengthMicros is not null),
            6 => command.Kind == "close-cash",
            _ => false,
        };
        if (next) practice.Step++;
        practice.Revision++;
        practice.UpdatedAt = work.Now;
    }
}

internal sealed class TimberPracticeService(KhypuPymeDbContext db, BusinessAccess access, LicenseAccess license, TimeProvider clock)
{
    public async Task<PracticeStatus> ReadAsync(Guid owner, Guid origin, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, origin, ct, IsolationLevel.RepeatableRead);
        await OriginAsync(origin, ct);
        var practice = await db.Set<TimberPractice>().AsNoTracking().SingleOrDefaultAsync(x => x.OriginId == origin, ct);
        return await StatusAsync(owner, practice, ct);
    }

    public async Task<PracticeStatus> ChangeAsync(Guid owner, Guid origin, PracticeInput request, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await using var tx = await access.OpenAsync(owner, origin, ct);
        await access.LockBusinessAsync(origin, ct);
        var source = await OriginAsync(origin, ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({origin.ToString()}, 5))", ct);
        var current = await db.Set<TimberPractice>().FindAsync([owner, origin], ct);
        if (request.Action is "start" or "resume" or "reports-seen")
            await license.RequireAsync(owner, origin, now, ct);

        if (request.Action == "start")
        {
            if (current?.SandboxId is not null) return await StatusAsync(owner, current, ct);
            var units = await db.BusinessSettings.Where(x => x.BusinessId == origin).Select(x => x.TimberUnits).SingleAsync(ct);
            var sandbox = Guid.NewGuid();
            current ??= db.Add(new TimberPractice { OwnerId = owner, OriginId = origin, State = "active" }).Entity;
            current.SandboxId = sandbox;
            current.State = "active";
            current.Step = 0;
            current.Revision++;
            current.UpdatedAt = now;
            await db.SaveChangesAsync(ct);
            await access.SetAsync(owner, sandbox, ct);
            db.Add(new Business
            {
                Id = sandbox, OwnerId = owner, PracticeOriginId = origin,
                Name = source.Name[..Math.Min(88, source.Name.Length)] + " · práctica",
                Industry = "timber", CreationDigest = "practice",
            });
            db.Add(new BusinessSettings { BusinessId = sandbox, OwnerId = owner, City = "", Phone = "", TimberUnits = units });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ToStatus(current, units);
        }

        if (current?.SandboxId is not Guid active)
            throw new CommerceFailure("La práctica ya terminó o no existe.", 409);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({active.ToString()}, 3))", ct);
        await db.Entry(current).ReloadAsync(ct);
        if (current.Revision != request.Revision) throw new CommerceFailure("Cambió el avance. Actualiza la práctica.", 409);
        switch (request.Action)
        {
            case "pause" when current.State == "active":
                current.State = "paused";
                break;
            case "resume" when current.State == "paused":
                current.State = "active";
                break;
            case "reports-seen" when current.State == "active" && current.Step == PracticeSteps.Reports:
                current.Step++;
                break;
            case "finish" when current.Step == PracticeSteps.Done:
            case "abandon":
                current.State = request.Action == "finish" ? "completed" : "abandoned";
                current.SandboxId = null;
                break;
            default:
                throw new CommerceFailure("La acción no corresponde al estado de la práctica.", 409);
        }
        current.Revision++;
        current.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        if (current.SandboxId is null)
        {
            await access.SetAsync(owner, active, ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('app.practice_origin', {origin.ToString()}, true)", ct);
            var deleted = await db.Businesses.Where(x => x.Id == active && x.OwnerId == owner && x.PracticeOriginId == origin).ExecuteDeleteAsync(ct);
            if (deleted != 1) throw new CommerceFailure("La limpieza de la práctica sigue pendiente.", 409);
        }

        var status = await StatusAsync(owner, current, ct);
        await tx.CommitAsync(ct);
        return status;
    }

    private async Task<Business> OriginAsync(Guid origin, CancellationToken ct) =>
        await access.VisibleBusinesses().AsNoTracking().SingleOrDefaultAsync(x => x.Id == origin && x.PracticeOriginId == null && x.Industry == "timber", ct)
        ?? throw new CommerceFailure("No se encontró un negocio de madera autorizado.", 404);

    private async Task<PracticeStatus> StatusAsync(Guid owner, TimberPractice? practice, CancellationToken ct)
    {
        if (practice?.SandboxId is not Guid sandbox) return ToStatus(practice, null);
        await access.SetAsync(owner, sandbox, ct);
        var units = await db.BusinessSettings.Where(x => x.BusinessId == sandbox).Select(x => x.TimberUnits).SingleAsync(ct);
        return ToStatus(practice, units);
    }

    private static PracticeStatus ToStatus(TimberPractice? practice, string? units) => new(practice is null ? null :
        new PracticeInfo(practice.SandboxId, practice.Step, practice.Revision, practice.State, units));
}

internal static class TimberPracticeEndpoints
{
    public static void MapTimberPractice(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/businesses/{businessId:guid}/practice").WithTags("Práctica").RequireAuthorization("Account");
        group.MapGet("", async (Guid businessId, HttpContext http, TimberPracticeService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.ReadAsync(BusinessAccess.AccountId(http), businessId, ct)); }
            catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
        }).Produces<PracticeStatus>();
        group.MapPost("", async (Guid businessId, PracticeInput input, HttpContext http, TimberPracticeService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.ChangeAsync(BusinessAccess.AccountId(http), businessId, input, ct)); }
            catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
        }).AddEndpointFilter<CsrfFilter>().Produces<PracticeStatus>();
    }
}
