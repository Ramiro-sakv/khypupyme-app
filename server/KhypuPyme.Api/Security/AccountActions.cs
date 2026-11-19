using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace KhypuPyme.Api.Security;

internal sealed class AccountActions(KhypuPymeDbContext db, BusinessAccess access, BusinessRemoval removal, SecurityProofs proofs,
    UserManager<IdentityUser<Guid>> users, IOpenIddictTokenManager tokens, TimeProvider clock)
{
    public async Task ApplyAsync(Guid owner, Guid proofId, bool closure, CancellationToken ct)
    {
        await using var tx = await access.OpenAsync(owner, null, ct);
        await access.LockSelectionAsync(owner, ct);
        var user = await db.Set<IdentityUser<Guid>>().SingleAsync(x => x.Id == owner, ct);
        if (closure)
        {
            var businesses = await db.Businesses.Where(x => x.PracticeOriginId == null).Select(x => x.Id).OrderBy(x => x).ToArrayAsync(ct);
            foreach (var business in businesses)
            {
                await access.LockBusinessAsync(business, ct);
                if (await access.DeletingAsync(business, ct))
                    throw new CommerceFailure("Completa las limpiezas de negocio pendientes antes de solicitar la baja.", 409);
                await access.SetAsync(owner, business, ct);
                await removal.RequireIdleAsync(owner, business, ct);
            }
            await access.SetAsync(owner, null, ct);
        }
        var purpose = closure ? "delete-account" : "revoke-sessions";
        proofs.Consume(await proofs.FindAsync(owner, proofId, purpose, null, purpose, ct));
        if (closure)
        {
            db.Add(new AccountClosure { OwnerId = owner, RequestedAt = clock.GetUtcNow() });
            Ensure(await users.SetLockoutEndDateAsync(user, clock.GetUtcNow().AddYears(100)));
        }
        Ensure(await users.UpdateSecurityStampAsync(user));
        var sessions = new List<object>();
        await foreach (var token in tokens.FindBySubjectAsync(owner.ToString(), ct)) sessions.Add(token);
        foreach (var token in sessions)
            if (!await tokens.TryRevokeAsync(token, ct))
                throw new CommerceFailure("No se pudo revocar una sesión. Vuelve a intentar.", 503);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded) throw new CommerceFailure("No se pudo actualizar la cuenta. Vuelve a intentar.", 409);
    }
}
