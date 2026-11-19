using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Timber;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Security;

internal sealed class BusinessRemoval(KhypuPymeDbContext db, BusinessAccess access, SecurityProofs proofs, TimeProvider clock)
{
    public async Task<BusinessDeletionInfo[]> PendingAsync(Guid owner, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, null, ct);
        var jobs = await db.Set<BusinessDeletion>().Where(x => x.CompletedAt == null).OrderBy(x => x.RequestedAt).ToArrayAsync(ct);
        return jobs.Select(Show).ToArray();
    }

    public async Task<BusinessDeletionInfo?> StatusAsync(Guid owner, Guid id, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, id, ct);
        await access.LockBusinessAsync(id, ct);
        var job = await db.Set<BusinessDeletion>().FindAsync([id], ct);
        return job is null ? null : Show(job);
    }

    public async Task SendCodeAsync(Guid owner, Guid id, IdentityConfirmation input, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, id, ct);
        var business = await PrepareAsync(owner, id, input.Name, ct);
        var proof = await proofs.FindAsync(owner, input.Id, "delete-business", id, SecurityProofs.NameBinding(business.Name), ct);
        await proofs.SendDeletionCodeAsync(tx, proof, ct);
    }

    public async Task<BusinessDeletionInfo> ConfirmAsync(Guid owner, Guid id, IdentityConfirmation input, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, id, ct);
        var business = await PrepareAsync(owner, id, input.Name, ct);
        var proof = await proofs.FindAsync(owner, input.Id, "delete-business", id, SecurityProofs.NameBinding(business.Name), ct);
        await proofs.VerifyCodeAsync(tx, proof, "delete-mail", input.Code, ct);
        SecurityProofs.MarkUsed(proof);
        var job = new BusinessDeletion { OwnerId = owner, BusinessId = id, Name = business.Name, RequestedAt = clock.GetUtcNow(),
            SandboxId = await SandboxAsync(id, ct) };
        db.Add(job);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Show(job);
    }

    public async Task<BusinessDeletionInfo> ResumeAsync(Guid owner, Guid id, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, id, ct);
        await access.LockBusinessAsync(id, ct);
        var job = await db.Set<BusinessDeletion>().FindAsync([id], ct)
            ?? throw new CommerceFailure("Primero confirma el borrado con el código.", 404);
        if (job.CompletedAt is not null) return Show(job);
        if (job.SandboxId is Guid sandbox) await access.LockBusinessAsync(sandbox, ct);
        await RequireIdleAsync(owner, id, ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('app.delete_business', {id.ToString()}, true)", ct);
        await access.SetAsync(owner, null, ct);
        var removed = await db.Businesses.Where(x => x.OwnerId == owner &&
            (x.Id == id && x.PracticeOriginId == null || x.Id == job.SandboxId && x.PracticeOriginId == id)).ExecuteDeleteAsync(ct);
        var expected = job.SandboxId is null ? 1 : 2;
        if (removed != expected || await db.Businesses.AnyAsync(x => x.Id == id || x.Id == job.SandboxId, ct))
            throw new CommerceFailure("La limpieza todavía está pendiente. Reintenta desde Mis negocios.", 409);
        job.CompletedAt = clock.GetUtcNow();
        job.Name = null;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Show(job);
    }

    public async Task RequireIdleAsync(Guid owner, Guid business, CancellationToken ct)
    {
        var sandbox = await SandboxAsync(business, ct);
        if (sandbox is Guid id) await access.LockBusinessAsync(id, ct);
        await CheckAsync(business);
        if (sandbox is Guid practice)
        {
            await access.SetAsync(owner, practice, ct);
            await CheckAsync(practice);
            await access.SetAsync(owner, business, ct);
        }

        async Task CheckAsync(Guid scope)
        {
            if (await db.Set<CashSession>().AnyAsync(x => x.BusinessId == scope && x.ClosedAt == null, ct))
                throw new CommerceFailure("Cierra la caja abierta del negocio o de su práctica antes de continuar.", 409);
            if (await db.Set<CommerceReceipt>().AnyAsync(x => x.BusinessId == scope && x.AcknowledgedAt == null, ct))
                throw new CommerceFailure("Hay una operación por revisar. Consulta su resultado antes de continuar.", 409);
        }
    }

    private async Task<Business> PrepareAsync(Guid owner, Guid id, string? name, CancellationToken ct)
    {
        await access.LockBusinessAsync(id, ct);
        var business = await db.Businesses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == owner && x.PracticeOriginId == null, ct)
            ?? throw new CommerceFailure("No se encontró el negocio.", 404);
        if (await access.DeletingAsync(id, ct)) throw new CommerceFailure("El negocio ya tiene una limpieza pendiente.", 409);
        if (!string.Equals(name, business.Name, StringComparison.Ordinal)) throw new CommerceFailure("Escribe el nombre exacto del negocio.");
        await RequireIdleAsync(owner, id, ct);
        return business;
    }

    private Task<Guid?> SandboxAsync(Guid id, CancellationToken ct) =>
        db.Set<TimberPractice>().Where(x => x.OriginId == id).Select(x => x.SandboxId).SingleOrDefaultAsync(ct);

    private static BusinessDeletionInfo Show(BusinessDeletion row) =>
        new(row.BusinessId, row.SandboxId, row.Name, row.CompletedAt is null ? "pending" : "completed", row.RequestedAt);
}
