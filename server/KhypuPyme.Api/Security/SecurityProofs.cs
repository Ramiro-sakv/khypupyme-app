using System.Security.Cryptography;
using System.Text;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Security;

internal sealed class SecurityProofs(KhypuPymeDbContext db, BusinessAccess access, LocalMailbox mailbox,
    SignInManager<IdentityUser<Guid>> signIn, IDataProtectionProvider protection, TimeProvider clock)
{
    private readonly IDataProtector protector = protection.CreateProtector("KhypuPyme.SecurityProofs.v1");

    public async Task<SecurityMethods> MethodsAsync(Guid owner, CancellationToken ct)
    {
        var user = await UserAsync(owner, ct);
        return new(user.PasswordHash is not null, user is { EmailConfirmed: true, Email: not null } && mailbox.IsEnabled);
    }

    public async Task<ProofResult> ApproveAsync(Guid owner, ProofInput input, CancellationToken ct)
    {
        if (input.Id == Guid.Empty || input.Purpose is not ("correction" or "delete-business" or "delete-account" or "revoke-sessions"))
            throw new CommerceFailure("La autorización no corresponde a una acción protegida.");
        await using var tx = await access.OpenAsync(owner, input.BusinessId, ct);
        await LockAsync(owner, input.Id, ct);

        var (binding, reason) = await BindingAsync(input, ct);
        var user = await UserAsync(owner, ct);
        var proof = await db.Set<SecurityProof>().FindAsync([owner, input.Id], ct);
        if (proof is not null) CheckBinding(proof, input.Purpose, input.BusinessId, binding, reason);
        if (proof is { Stage: "used" or "delete-mail" })
            throw new CommerceFailure("Esta confirmación ya se utilizó. Inicia una nueva.", 409);
        var now = clock.GetUtcNow();
        if (proof?.Stage == "approved" && proof.ExpiresAt > now)
            return new("approved", proof.ExpiresAt);

        if (proof is null)
        {
            proof = new SecurityProof { OwnerId = owner, Id = input.Id, BusinessId = input.BusinessId,
                Purpose = input.Purpose, Binding = binding, Reason = reason };
            db.Add(proof);
        }
        if (user.PasswordHash is not null)
        {
            if (input.Password is not { Length: > 0 and <= 128 } || input.SendCode || input.Code is not null)
                throw new CommerceFailure("Confirma tu identidad con la contraseña de la cuenta.");
            var result = await signIn.CheckPasswordSignInAsync(user, input.Password, lockoutOnFailure: true);
            if (!result.Succeeded)
            {
                await tx.CommitAsync(ct); // Conserva el contador de intentos de Identity.
                throw new CommerceFailure(result.IsLockedOut ? "Espera antes de intentar de nuevo." : "La contraseña no coincide.",
                    result.IsLockedOut ? 429 : 400);
            }
        }
        else
        {
            if (input.SendCode)
            {
                var message = await IssueAsync(proof, user, "identity-mail", ct);
                await CommitAndDeliverAsync(tx, message, ct);
                return new(proof.Stage, proof.ExpiresAt);
            }
            await VerifyCodeAsync(tx, proof, "identity-mail", input.Code, ct);
        }
        proof.Stage = "approved";
        proof.ProtectedCode = null;
        proof.ExpiresAt = clock.GetUtcNow().AddMinutes(2);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new(proof.Stage, proof.ExpiresAt);
    }

    private async Task<(string Binding, string Reason)> BindingAsync(ProofInput input, CancellationToken ct)
    {
        if (input.Purpose == "correction")
        {
            if (input.BusinessId is not Guid id || input.Command is not { } command || command.OperationId != input.Id ||
                !await db.Businesses.AnyAsync(x => x.Id == id && x.PracticeOriginId == null, ct) ||
                await access.DeletingAsync(id, ct))
                throw new CommerceFailure("La operación no está disponible en este negocio.", 404);
            if (!CorrectionAudit.Protected(command) && !await CorrectionAudit.CashDifferenceAsync(db, command, ct))
                throw new CommerceFailure("Esta operación no necesita autorización.");
            return (CommerceService.Digest(command), Text(input.Reason, 240, "el motivo de la corrección", true));
        }
        if (input.Purpose == "delete-business")
        {
            var name = await db.Businesses.Where(x => x.Id == input.BusinessId && x.PracticeOriginId == null)
                .Select(x => x.Name).SingleOrDefaultAsync(ct)
                ?? throw new CommerceFailure("No se encontró el negocio.", 404);
            if (!string.Equals(input.Name, name, StringComparison.Ordinal)) throw new CommerceFailure("Escribe el nombre exacto del negocio.");
            return (NameBinding(name), "");
        }
        if (input.BusinessId is not null || input.Command is not null)
            throw new CommerceFailure("Esta acción corresponde a la cuenta.");
        return (input.Purpose, "");
    }

    public static string NameBinding(string name) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(name)));

    public async Task<SecurityProof> FindAsync(Guid owner, Guid id, string purpose, Guid? business, string binding, CancellationToken ct)
    {
        await LockAsync(owner, id, ct);
        var proof = await db.Set<SecurityProof>().FindAsync([owner, id], ct)
            ?? throw new CommerceFailure("Confirma tu identidad para continuar.", 422);
        CheckBinding(proof, purpose, business, binding);
        return proof;
    }

    public void Consume(SecurityProof proof)
    {
        RequireApproved(proof);
        MarkUsed(proof);
    }

    public void RequireApproved(SecurityProof proof)
    {
        if (proof.Stage != "approved" || proof.ExpiresAt <= clock.GetUtcNow())
            throw new CommerceFailure("La confirmación de identidad venció o ya se utilizó.", 422);
    }

    public static void MarkUsed(SecurityProof proof)
    {
        proof.Stage = "used";
        proof.ProtectedCode = null;
    }

    public async Task SendDeletionCodeAsync(IDbContextTransaction tx, SecurityProof proof, CancellationToken ct)
    {
        RequireApproved(proof);
        var message = await IssueAsync(proof, await UserAsync(proof.OwnerId, ct), "delete-mail", ct);
        await CommitAndDeliverAsync(tx, message, ct);
    }

    public async Task VerifyCodeAsync(IDbContextTransaction tx, SecurityProof proof, string stage, string? raw, CancellationToken ct)
    {
        if (proof.Stage != stage || proof.ExpiresAt <= clock.GetUtcNow() || proof.ProtectedCode is null)
            throw new CommerceFailure("El código venció o ya se utilizó. Solicita otro.");
        if (proof.Attempts >= 5) throw new CommerceFailure("Se agotaron los intentos. Solicita otro código.", 429);
        if (raw is not { Length: 5 } || !raw.All(char.IsAsciiDigit)) throw new CommerceFailure("Escribe el código de cinco dígitos.");
        string expected;
        try { expected = protector.Unprotect(proof.ProtectedCode); }
        catch (CryptographicException) { throw new CommerceFailure("Solicita un código nuevo."); }
        if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(raw), Encoding.ASCII.GetBytes(expected))) return;
        proof.Attempts++;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        throw new CommerceFailure(proof.Attempts >= 5 ? "Se agotaron los intentos." : "El código ingresado es incorrecto.",
            proof.Attempts >= 5 ? 429 : 400);
    }

    private async Task<Mail> IssueAsync(SecurityProof proof, IdentityUser<Guid> user, string stage, CancellationToken ct)
    {
        if (user is not { EmailConfirmed: true, Email: not null } || !mailbox.IsEnabled)
            throw new CommerceFailure("Comprueba que tu correo esté verificado y el buzón esté disponible.", 503);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({proof.OwnerId.ToString()}, 9))", ct);
        var limit = await db.Set<SecurityMailLimit>().FindAsync([proof.OwnerId], ct);
        if (limit is null) limit = db.Add(new SecurityMailLimit { OwnerId = proof.OwnerId }).Entity;
        var now = clock.GetUtcNow();
        var recent = limit.SentAt.Where(x => x > now.AddHours(-1)).ToArray();
        if (recent.Length >= 3 || recent.Any(x => x > now.AddMinutes(-1)))
            throw new CommerceFailure("Espera antes de solicitar otro código. Se admite un envío por minuto y tres por hora.", 429);
        var code = RandomNumberGenerator.GetInt32(100_000).ToString("D5");
        if (stage == "delete-mail")
            await db.Set<SecurityProof>().Where(x => x.OwnerId == proof.OwnerId && x.BusinessId == proof.BusinessId &&
                x.Id != proof.Id && x.Stage == stage).ExecuteUpdateAsync(update =>
                    update.SetProperty(x => x.Stage, "used").SetProperty(x => x.ProtectedCode, (string?)null), ct);
        limit.SentAt = [..recent, now];
        proof.Stage = stage;
        proof.ProtectedCode = protector.Protect(code);
        proof.Attempts = 0;
        proof.ExpiresAt = now.AddMinutes(10);
        return new(user.Email, stage == "delete-mail" ? "delete-business" : "security-identity", code);
    }

    private async Task CommitAndDeliverAsync(IDbContextTransaction tx, Mail mail, CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        try { await mailbox.DeliverAsync(mail.Email, mail.Purpose, mail.Code, ct); }
        catch (IOException) { throw new CommerceFailure("No se pudo entregar el código. Solicita otro.", 503); }
    }

    private Task LockAsync(Guid owner, Guid id, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({owner.ToString() + ":" + id}, 10))", ct);

    private async Task<IdentityUser<Guid>> UserAsync(Guid owner, CancellationToken ct) =>
        await db.Set<IdentityUser<Guid>>().SingleOrDefaultAsync(x => x.Id == owner, ct)
        ?? throw new CommerceFailure("Ingresa de nuevo para continuar.", 401);

    private static void CheckBinding(SecurityProof proof, string purpose, Guid? business, string binding, string? reason = null)
    {
        if (proof.Purpose != purpose || proof.BusinessId != business || proof.Binding != binding ||
            (reason is not null && proof.Reason != reason))
            throw new CommerceFailure("La autorización pertenece a otra operación. Inicia una confirmación nueva.", 422);
    }

    private sealed record Mail(string Email, string Purpose, string Code);
}
