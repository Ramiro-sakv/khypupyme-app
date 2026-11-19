using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;
using Microsoft.AspNetCore.Identity;

namespace KhypuPyme.Api.Security;

internal static class SecurityEndpoints
{
    public static void MapSecurity(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/security").RequireAuthorization("Account").WithTags("Seguridad");
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            try { return await next(context); }
            catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
        });
        group.MapGet("/methods", (HttpContext http, SecurityProofs proofs, CancellationToken ct) =>
            proofs.MethodsAsync(BusinessAccess.AccountId(http), ct)).Produces<SecurityMethods>();
        group.MapGet("/businesses", (HttpContext http, BusinessRemoval removal, CancellationToken ct) =>
            removal.PendingAsync(BusinessAccess.AccountId(http), ct)).Produces<BusinessDeletionInfo[]>();
        group.MapGet("/businesses/{id:guid}", async (Guid id, HttpContext http, BusinessRemoval removal, CancellationToken ct) =>
            await removal.StatusAsync(BusinessAccess.AccountId(http), id, ct) is { } status ? Results.Ok(status) : Results.NotFound())
            .Produces<BusinessDeletionInfo>();
        var writes = group.MapGroup("").AddEndpointFilter<CsrfFilter>().RequireRateLimiting("auth");
        writes.MapPost("/proof", (ProofInput input, HttpContext http, SecurityProofs proofs, CancellationToken ct) =>
            proofs.ApproveAsync(BusinessAccess.AccountId(http), input, ct)).Produces<ProofResult>();
        writes.MapPost("/businesses/{id:guid}/code", async (Guid id, IdentityConfirmation input, HttpContext http, BusinessRemoval removal, CancellationToken ct) =>
        {
            await removal.SendCodeAsync(BusinessAccess.AccountId(http), id, input, ct);
            return Results.NoContent();
        });
        writes.MapPost("/businesses/{id:guid}/confirm", (Guid id, IdentityConfirmation input, HttpContext http, BusinessRemoval removal, CancellationToken ct) =>
            removal.ConfirmAsync(BusinessAccess.AccountId(http), id, input, ct)).Produces<BusinessDeletionInfo>();
        writes.MapPost("/businesses/{id:guid}/resume", (Guid id, HttpContext http, BusinessRemoval removal, CancellationToken ct) =>
            removal.ResumeAsync(BusinessAccess.AccountId(http), id, ct)).Produces<BusinessDeletionInfo>();
        writes.MapPost("/account/revoke", (IdentityConfirmation input, HttpContext http, AccountActions actions,
            SignInManager<IdentityUser<Guid>> signIn, CancellationToken ct) => EndAccountAsync(input, http, actions, signIn, false, ct));
        writes.MapPost("/account/request-deletion", (IdentityConfirmation input, HttpContext http, AccountActions actions,
            SignInManager<IdentityUser<Guid>> signIn, CancellationToken ct) => EndAccountAsync(input, http, actions, signIn, true, ct));
    }

    private static async Task<IResult> EndAccountAsync(IdentityConfirmation input, HttpContext http, AccountActions actions,
        SignInManager<IdentityUser<Guid>> signIn, bool closure, CancellationToken ct)
    {
        await actions.ApplyAsync(BusinessAccess.AccountId(http), input.Id, closure, ct);
        await signIn.SignOutAsync();
        return Results.NoContent();
    }
}
