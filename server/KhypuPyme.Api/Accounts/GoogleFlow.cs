using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using KhypuPyme.Api.Hosting;

namespace KhypuPyme.Api.Accounts;

internal static class GoogleFlow
{
    public const string VerifiedEmailClaim = "google_verified_email";

    public static bool IsEnabled(IConfiguration configuration) =>
        !string.IsNullOrWhiteSpace(configuration["Google:ClientId"]) &&
        !string.IsNullOrWhiteSpace(configuration["Google:ClientSecret"]);

    public static void MapGoogle(this RouteGroupBuilder group)
    {
        group.MapGet("/google/start", (string? returnTo, HttpContext http, IConfiguration configuration) =>
        {
            if (!IsEnabled(configuration)) return AuthErrors.Fail("Google aún requiere configuración.", 503);
            var properties = new AuthenticationProperties { RedirectUri = "/api/v1/auth/google/complete" };
            if (NativeAuthorization.IsAuthorizePath(returnTo)) properties.Items["returnTo"] = returnTo;
            return Results.Challenge(properties, ["Google"]);
        });

        group.MapPost("/google/link", (HttpContext http, UserManager<IdentityUser<Guid>> users, IConfiguration configuration) =>
        {
            if (!IsEnabled(configuration)) return AuthErrors.Fail("Google aún requiere configuración.", 503);
            var properties = new AuthenticationProperties { RedirectUri = "/api/v1/auth/google/complete" };
            properties.Items["linkUser"] = users.GetUserId(http.User);
            return Results.Challenge(properties, ["Google"]);
        }).RequireAuthorization("BrowserSession").AddEndpointFilter<CsrfFilter>();
        group.MapGet("/google/complete", CompleteAsync);
    }

    private static async Task<IResult> CompleteAsync(
        HttpContext context, UserManager<IdentityUser<Guid>> users, SignInManager<IdentityUser<Guid>> signIn,
        EmailCodes codes, PilotOptions pilot, CancellationToken ct)
    {
        var external = await context.AuthenticateAsync(IdentityConstants.ExternalScheme);
        await context.SignOutAsync(IdentityConstants.ExternalScheme);
        var principal = external.Principal;
        var email = principal?.FindFirstValue(ClaimTypes.Email);
        var key = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!external.Succeeded || email is not { Length: > 0 and <= 256 } || string.IsNullOrEmpty(key) || !pilot.Allows(email) ||
            !string.Equals(principal?.FindFirstValue(VerifiedEmailClaim), "true", StringComparison.OrdinalIgnoreCase))
            return Results.LocalRedirect("/?auth=google-failed");

        var externalLogin = new UserLoginInfo("Google", key, "Google");
        var normalized = users.NormalizeEmail(email)!;
        await using var tx = await codes.LockAsync(normalized, ct);
        var linkedUser = await users.FindByLoginAsync("Google", key);

        if (external.Properties?.Items.TryGetValue("linkUser", out var expectedId) == true)
        {
            var currentUser = await users.GetUserAsync(context.User);
            if (currentUser is null || currentUser.Id.ToString() != expectedId || !currentUser.EmailConfirmed ||
                currentUser.NormalizedEmail != normalized || linkedUser is not null && linkedUser.Id != currentUser.Id)
                return Results.LocalRedirect("/?auth=google-failed");
            if (linkedUser is null && !(await users.AddLoginAsync(currentUser, externalLogin)).Succeeded)
                return Results.LocalRedirect("/?auth=google-failed");
            await tx.CommitAsync(ct);
            return Results.LocalRedirect("/?auth=google-linked");
        }

        if (linkedUser is null)
        {
            if (await users.FindByEmailAsync(email) is not null)
                return Results.LocalRedirect("/?auth=link-required");

            linkedUser = new IdentityUser<Guid> { Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true };
            if (!(await users.CreateAsync(linkedUser)).Succeeded ||
                !(await users.AddLoginAsync(linkedUser, externalLogin)).Succeeded)
                return Results.LocalRedirect("/?auth=google-failed");
        }
        if (!linkedUser.EmailConfirmed || await users.IsLockedOutAsync(linkedUser))
            return Results.LocalRedirect("/?auth=google-failed");

        await tx.CommitAsync(ct);
        await signIn.SignInAsync(linkedUser, isPersistent: false, authenticationMethod: "Google");
        var returnTo = external.Properties?.Items.TryGetValue("returnTo", out var target) == true ? target : null;
        return Results.LocalRedirect(NativeAuthorization.IsAuthorizePath(returnTo) ? returnTo! : "/");
    }
}
