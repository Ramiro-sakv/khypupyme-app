using System.Text.Json;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Commerce;

namespace KhypuPyme.Api.Billing;

internal static class BillingEndpoints
{
    public static void MapBilling(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/businesses/{businessId:guid}/plan").RequireAuthorization("Account").WithTags("Planes");
        group.AddEndpointFilter(async (invocation, next) =>
        {
            invocation.HttpContext.Response.Headers.CacheControl = "no-store";
            try { return await next(invocation); }
            catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
        });
        group.MapGet("", (Guid businessId, HttpContext http, BillingService service, CancellationToken ct) =>
            service.ReadAsync(BusinessAccess.AccountId(http), businessId, ct)).Produces<PlanStatus>();
        var writes = group.MapGroup("").AddEndpointFilter<CsrfFilter>();
        writes.MapPost("/trial", async (Guid businessId, HttpContext http, BillingService service, CancellationToken ct) =>
        {
            await service.ActivateTrialAsync(BusinessAccess.AccountId(http), businessId, ct);
            return Results.NoContent();
        });
        writes.MapPost("/attempts", async (Guid businessId, HttpContext http, BillingService service, CancellationToken ct) =>
            Results.Ok(await service.BeginAsync(BusinessAccess.AccountId(http), businessId,
                await ReadInputAsync<CheckoutInput>(http.Request, ct), ct)))
            .Accepts<CheckoutInput>("application/json").Produces<PaymentInfo>();
        writes.MapPost("/attempts/{id:guid}", async (Guid businessId, Guid id, HttpContext http, BillingService service, CancellationToken ct) =>
            Results.Ok(await service.ChangeAsync(BusinessAccess.AccountId(http), businessId, id,
                await ReadInputAsync<CheckoutAction>(http.Request, ct), ct)))
            .Accepts<CheckoutAction>("application/json").Produces<PaymentInfo>();
    }

    private static async Task<T> ReadInputAsync<T>(HttpRequest request, CancellationToken ct) where T : class
    {
        const string message = "El pago de demostración solo admite los datos de la selección y del intento.";
        if (!request.HasJsonContentType()) throw new CommerceFailure(message);
        try { return await request.ReadFromJsonAsync<T>(ct) ?? throw new CommerceFailure(message); }
        catch (JsonException) { throw new CommerceFailure(message); }
    }
}
