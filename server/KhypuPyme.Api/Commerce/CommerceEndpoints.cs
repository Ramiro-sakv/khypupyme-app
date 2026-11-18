using System.Data;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Commerce;

internal static class CommerceEndpoints
{
    public static void MapCommerce(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/businesses/{businessId:guid}/commerce").WithTags("Comercio")
            .RequireAuthorization("Account");
        var reads = group.MapGroup("").AddEndpointFilter<ReadCommerceScope>();
        reads.MapGet("/products", (string? search, bool? active, int? page, CommerceReads service, CancellationToken ct) =>
            service.ProductsAsync(search, active, page, ct)).Produces<CommercePage<ProductInfo>>();
        reads.MapGet("/products/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.ProductAsync(id, ct))).Produces<ProductInfo>();
        reads.MapGet("/customers", (string? search, int? page, CommerceReads service, CancellationToken ct) =>
            service.CustomersAsync(search, page, ct)).Produces<CommercePage<CustomerInfo>>();
        reads.MapGet("/customers/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.CustomerAsync(id, ct))).Produces<CustomerInfo>();
        reads.MapGet("/history", (string? kind, Guid? cashSession, int? page, CommerceReads service, CancellationToken ct) =>
            service.HistoryAsync(kind, cashSession, page, ct)).Produces<CommercePage<EntryInfo>>();
        reads.MapGet("/documents/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.DocumentAsync(id, ct))).Produces<EntryDocument>();
        reads.MapGet("/cash", (CommerceReads service, CancellationToken ct) => service.CashAsync(ct)).Produces<CashStatus>();
        reads.MapGet("/debts", (bool? paid, int? page, CommerceReads service, CancellationToken ct) =>
            service.DebtsAsync(paid, page, ct)).Produces<CommercePage<ReceivableInfo>>();
        reads.MapGet("/report", (DateOnly? from, DateOnly? to, CommerceReads service, CancellationToken ct) =>
            service.ReportAsync(from, to, ct)).Produces<CommerceReport>();
        reads.MapGet("/commands/{id:guid}", StatusAsync).Produces<CommandResult>();
        group.MapPost("/commands", ExecuteAsync).AddEndpointFilter<CsrfFilter>().Produces<CommandResult>();
    }

    private static IResult Found<T>(T? result) where T : class => result is null ? Results.NotFound() : Results.Ok(result);

    private static async Task<IResult> ExecuteAsync(Guid businessId, CommerceCommand request, HttpContext http,
        CommerceService service, CancellationToken ct)
    {
        try { return Results.Ok(await service.ExecuteAsync(BusinessAccess.AccountId(http), businessId, request, ct)); }
        catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
    }

    private static async Task<IResult> StatusAsync(Guid businessId, Guid id, KhypuPymeDbContext db, CancellationToken ct)
    {
        var found = await db.Set<CommerceReceipt>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.BusinessId == businessId, ct);
        return found is null ? Results.NotFound() : Results.Ok(new CommandResult(found.Id, found.Kind, found.EntityId));
    }
}

internal sealed class ReadCommerceScope(BusinessAccess access, KhypuPymeDbContext db) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var business = Guid.Parse((string)http.Request.RouteValues["businessId"]!);
        var ct = http.RequestAborted;
        http.Response.Headers.CacheControl = "no-store";
        await using var tx = await access.OpenAsync(BusinessAccess.AccountId(http), business, ct, IsolationLevel.RepeatableRead);
        if (!await db.Businesses.AnyAsync(x => x.Id == business, ct)) return Results.NotFound();
        try { return await next(context); }
        catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
    }
}
