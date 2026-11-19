using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Antiforgery;

using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using KhypuPyme.Api.Hosting;
using KhypuPyme.Api.Businesses;

namespace KhypuPyme.Api.Accounts;

internal static class AccountEndpoints
{
    public static void MapAccounts(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/auth").WithTags("Cuentas");
        group.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery) =>
        {
            return TypedResults.Ok(new CsrfToken(antiforgery.GetAndStoreTokens(context).RequestToken!));
        });
        group.MapGet("/session", SessionAsync);
        group.MapGet("/native-session", async (HttpContext http, UserManager<IdentityUser<Guid>> users) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var user = await users.FindByIdAsync(BusinessAccess.AccountId(http).ToString());
            return TypedResults.Ok(new SessionInfo(user?.Email, false, false, user?.Id));
        }).RequireAuthorization("Account");
        var writes = group.MapGroup("").AddEndpointFilter<CsrfFilter>().RequireRateLimiting("auth");
        writes.MapPost("/register/code", SendRegistrationAsync);
        writes.MapPost("/register", RegisterAsync);
        writes.MapPost("/login", LoginAsync);
        writes.MapPost("/logout", async (SignInManager<IdentityUser<Guid>> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        });
        writes.MapPost("/recover/code", SendRecoveryAsync);
        writes.MapPost("/recover", RecoverAsync);

        group.MapGoogle();
    }

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.Ok<SessionInfo>> SessionAsync(
        HttpContext context, UserManager<IdentityUser<Guid>> users, PilotOptions pilot, IWebHostEnvironment environment)
    {
        context.Response.Headers.CacheControl = "no-store";
        var user = await users.GetUserAsync(context.User);
        if (!pilot.Allows(user?.Email)) user = null;
        var googleConfigured = GoogleFlow.IsEnabled(context.RequestServices.GetRequiredService<IConfiguration>());
        var linked = user is not null && (await users.GetLoginsAsync(user)).Any(login => login.LoginProvider == "Google");
        return TypedResults.Ok(new SessionInfo(user?.Email, googleConfigured, linked, user?.Id,
            LocalMailbox: environment.IsDevelopment() && !pilot.Enabled));
    }

    private static bool ValidEmail(string? email) =>
        email is { Length: > 0 and <= 256 } && new EmailAddressAttribute().IsValid(email);

    private static bool ValidCode(string? code) => code is { Length: 5 } && code.All(char.IsAsciiDigit);
    private static bool ValidPassword(string? password) => password is { Length: >= 12 and <= 128 };

    private static async Task<IResult> SendRegistrationAsync(EmailInput input, UserManager<IdentityUser<Guid>> users,
        EmailCodes codes, PilotOptions pilot, CancellationToken ct)
    {
        var email = input.Email?.Trim();
        if (!ValidEmail(email)) return AuthErrors.Fail("Escribe un correo válido.");
        if (!pilot.Allows(email)) return AuthErrors.Fail("Este piloto requiere un correo invitado.", 403);
        var user = await users.FindByEmailAsync(email!);
        return await codes.SendAsync(email!, users.NormalizeEmail(email)!, EmailCodes.Registration,
            user is null, ct);
    }

    private static async Task<IResult> RegisterAsync(CodePasswordInput input, UserManager<IdentityUser<Guid>> users,
        EmailCodes codes, PilotOptions pilot, CancellationToken ct)
    {
        var email = input.Email?.Trim();
        if (!ValidEmail(email) || !ValidCode(input.Code)) return AuthErrors.Fail("Escribe un correo y el código de cinco dígitos.");
        if (!ValidPassword(input.Password)) return AuthErrors.Fail("Usa entre 12 y 128 caracteres para la contraseña.");
        if (!pilot.Allows(email)) return AuthErrors.Fail("Este piloto requiere un correo invitado.", 403);

        return await codes.RedeemAsync(users.NormalizeEmail(email)!, EmailCodes.Registration, input.Code!,
            async () => await users.CreateAsync(new IdentityUser<Guid>
            {
                Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            }, input.Password!), ct);
    }

    private static async Task<IResult> LoginAsync(PasswordInput input, UserManager<IdentityUser<Guid>> users,
        SignInManager<IdentityUser<Guid>> signIn, PilotOptions pilot)
    {
        var email = input.Email?.Trim();
        if (!ValidEmail(email) || input.Password is not { Length: > 0 and <= 128 })
            return AuthErrors.Fail("Revisa tu correo y contraseña.", 401);
        if (!pilot.Allows(email)) return AuthErrors.Fail("Este piloto requiere un correo invitado.", 403);

        var user = await users.FindByEmailAsync(email!);
        if (user is null) return AuthErrors.Fail("Revisa tu correo y contraseña.", 401);
        var result = await signIn.PasswordSignInAsync(user, input.Password, false, lockoutOnFailure: true);
        return result.Succeeded ? Results.NoContent() : AuthErrors.Fail(
            result.IsLockedOut ? "La cuenta está bloqueada temporalmente. Intenta más tarde." : "Revisa tu correo y contraseña.",
            result.IsLockedOut ? 429 : 401);
    }

    private static async Task<IResult> SendRecoveryAsync(EmailInput input, UserManager<IdentityUser<Guid>> users,
        EmailCodes codes, PilotOptions pilot, CancellationToken ct)
    {
        var email = input.Email?.Trim();
        if (!ValidEmail(email)) return AuthErrors.Fail("Escribe un correo válido.");
        if (!pilot.Allows(email)) return Results.NoContent();
        var user = await users.FindByEmailAsync(email!);
        return await codes.SendAsync(email!, users.NormalizeEmail(email)!, EmailCodes.Recovery,
            user is { EmailConfirmed: true, PasswordHash: not null } && !ClosureLock(user), ct);
    }

    private static async Task<IResult> RecoverAsync(CodePasswordInput input, UserManager<IdentityUser<Guid>> users,
        SignInManager<IdentityUser<Guid>> signIn, EmailCodes codes, IOpenIddictTokenManager tokens, PilotOptions pilot, CancellationToken ct)
    {
        var email = input.Email?.Trim();
        if (!ValidEmail(email) || !ValidCode(input.Code)) return AuthErrors.Fail("Escribe un correo y el código de cinco dígitos.");
        if (!ValidPassword(input.Password)) return AuthErrors.Fail("Usa entre 12 y 128 caracteres para la contraseña.");
        if (!pilot.Allows(email)) return AuthErrors.Fail("El código venció o ya se usó. Solicita otro.");

        var user = await users.FindByEmailAsync(email!);
        if (user is not { EmailConfirmed: true, PasswordHash: not null } || ClosureLock(user))
            return AuthErrors.Fail("El código venció o ya se usó. Solicita otro.");

        var result = await codes.RedeemAsync(users.NormalizeEmail(email)!, EmailCodes.Recovery, input.Code!, async () =>
        {
            var reset = await users.ResetPasswordAsync(user, await users.GeneratePasswordResetTokenAsync(user), input.Password!);
            if (!reset.Succeeded) return reset;
            var unlocked = await users.SetLockoutEndDateAsync(user, null);
            if (!unlocked.Succeeded) return unlocked;
            var existingTokens = new List<object>();
            await foreach (var token in tokens.FindBySubjectAsync(user.Id.ToString(), ct)) existingTokens.Add(token);
            foreach (var token in existingTokens)
            {
                if (!await tokens.TryRevokeAsync(token, ct))
                    return IdentityResult.Failed(new IdentityError { Code = "RevokeSessionFailed" });
            }
            return IdentityResult.Success;
        }, ct);
        if (result is Microsoft.AspNetCore.Http.HttpResults.NoContent) await signIn.SignOutAsync();
        return result;
    }

    private static bool ClosureLock(IdentityUser<Guid> user) => user.LockoutEnd > DateTimeOffset.UtcNow.AddYears(50);
}

internal sealed class CsrfFilter(IAntiforgery antiforgery) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if ((http.Request.Path.StartsWithSegments("/api/v1/businesses") || http.Request.Path.StartsWithSegments("/api/v1/security")) &&
            http.Request.Headers.Authorization.Count != 0 && http.User.Identity?.IsAuthenticated == true)
            return await next(context);

        if (!await antiforgery.IsRequestValidAsync(http))
            return AuthErrors.Fail("La sesión del formulario caducó. Actualiza la página e inténtalo de nuevo.", 400);
        return await next(context);
    }
}

public sealed record CsrfToken(string Token);
public sealed record SessionInfo(string? Email, bool GoogleConfigured, bool GoogleLinked, Guid? AccountId, bool LocalMailbox = false);
public sealed record EmailInput(string? Email);
public sealed record PasswordInput(string? Email, string? Password);
public sealed record CodePasswordInput(string? Email, string? Code, string? Password);
