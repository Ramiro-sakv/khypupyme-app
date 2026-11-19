using System.Data;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using KhypuPyme.Api.Security;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal static class CommerceEndpoints
{
    public static void MapCommerce(this WebApplication app)
    {
        MapGroup(app.MapGroup("/api/v1/businesses/{businessId:guid}/commerce"));
        MapGroup(app.MapGroup("/api/v1/businesses/{businessId:guid}/practice-commerce").WithMetadata(new PracticeCommerce()), practice: true);
    }

    private static void MapGroup(RouteGroupBuilder group, bool practice = false)
    {
        group.WithTags("Comercio").RequireAuthorization("Account");
        var reads = group.MapGroup("").AddEndpointFilter<ReadCommerceScope>();
        reads.MapGet("/products", (string? search, bool? active, string? attention, string? vehicleBrand, string? vehicleModel, int? year,
            bool? service, int? page, CommerceReads query, CancellationToken ct) =>
            query.ProductsAsync(search, active, attention, vehicleBrand, vehicleModel, year, service, page, ct)).Produces<CommercePage<ProductInfo>>();
        reads.MapGet("/products/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.ProductAsync(id, ct))).Produces<ProductInfo>();
        reads.MapGet("/products/batch", (Guid businessId, string ids, CommerceReads service, CancellationToken ct) =>
            service.ProductBatchAsync(businessId, ids, ct)).Produces<ProductInfo[]>();
        reads.MapPost("/availability", (Guid businessId, StockRequest input, StockReads stock, CancellationToken ct) => stock.CheckAsync(businessId, input, ct))
            .AddEndpointFilter<CsrfFilter>().Produces<StockCheck[]>();
        reads.MapGet("/warehouse", (string? search, string? status, string? attention, string? vehicleBrand,
            string? vehicleModel, int? year, int? page, StockReads stock, CancellationToken ct) =>
            stock.WarehouseAsync(search, status, attention, vehicleBrand, vehicleModel, year, page, ct)).Produces<CommercePage<WarehouseItem>>();
        reads.MapGet("/warehouse/{id:guid}/movements", (Guid id, int? page, StockReads stock, CancellationToken ct) =>
            stock.MovementsAsync(id, page, ct)).Produces<CommercePage<StockMovement>>();
        reads.MapGet("/products/code", async (string? code, StoreReads store, CancellationToken ct) =>
            Found(await store.CodeAsync(code, ct))).Produces<ProductInfo>();
        reads.MapGet("/variants", (string? model, StoreReads store, CancellationToken ct) =>
            store.VariantsAsync(model, ct)).Produces<ProductInfo[]>();
        reads.MapGet("/lots/{id:guid}", (Guid id, string? lot, bool? sellable, int? page, StoreReads store, CancellationToken ct) =>
            store.LotsAsync(id, lot, sellable, page, ct)).Produces<CommercePage<LotInfo>>();
        reads.MapGet("/serials", (Guid? product, string? search, string? state, int? page, StoreReads store, CancellationToken ct) =>
            store.SerialsAsync(product, search, state, page, ct)).Produces<CommercePage<SerialInfo>>();
        reads.MapGet("/serial", async (string? serial, StoreReads store, CancellationToken ct) =>
            Found(await store.SerialAsync(serial, ct))).Produces<UnitHistory>();
        reads.MapGet("/attention", (StoreReads store, CancellationToken ct) =>
            store.AttentionAsync(ct)).Produces<StoreAttention>();
        reads.MapGet("/deliveries", (int? page, string? filter, string? mode, string? search, KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct) =>
            FurnitureDeliveries.ListAsync(db, filter, mode, search, LocalDate(clock.GetUtcNow()), page, ct))
            .Produces<CommercePage<DeliveryInfo>>();
        reads.MapGet("/delivery-attention", (KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct) =>
            FurnitureDeliveries.AttentionAsync(db, LocalDate(clock.GetUtcNow()), ct)).Produces<DeliveryAttention>();
        reads.MapGet("/work", (DateOnly? day, string? filter, string? search, int? page, KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct) =>
            WorkQueries.ListAsync(db, day, filter, search, LocalDate(clock.GetUtcNow()), page, ct)).Produces<CommercePage<WorkInfo>>();
        reads.MapGet("/work/{id:guid}", async (Guid id, KhypuPymeDbContext db, CancellationToken ct) =>
            Found(await WorkQueries.FindAsync(db, id, ct))).Produces<WorkInfo>();
        reads.MapGet("/work-attention", (KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct) =>
            WorkQueries.AttentionAsync(db, LocalDate(clock.GetUtcNow()), ct)).Produces<WorkAttention>();
        reads.MapGet("/container-obligations", (string? search, int? page, KhypuPymeDbContext db, CancellationToken ct) =>
            ContainerService.ObligationsAsync(db, search, page, ct)).Produces<CommercePage<ContainerObligation>>();
        reads.MapGet("/containers", async (Guid? customer, KhypuPymeDbContext db, CancellationToken ct) =>
        {
            if (customer is Guid id && !await db.Set<Customer>().AnyAsync(x => x.Id == id, ct))
                throw new CommerceFailure("El cliente no está disponible en este negocio.", 404);
            return await ContainerService.ListAsync(customer, db, ct);
        }).Produces<ContainerInfo[]>();
        reads.MapGet("/timber-stock/{id:guid}", (Guid id, long? length, long? thickness, long? width, string? widths,
            string? category, int? page, CommerceReads service, CancellationToken ct) =>
            service.TimberStockAsync(id, length, thickness, width, widths, category, page, ct))
            .Produces<CommercePage<TimberStockInfo>>();
        reads.MapGet("/customers", (string? search, int? page, CommerceReads service, CancellationToken ct) =>
            service.CustomersAsync(search, page, ct)).Produces<CommercePage<CustomerInfo>>();
        reads.MapGet("/customers/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.CustomerAsync(id, ct))).Produces<CustomerInfo>();
        reads.MapGet("/history", (string? kind, Guid? cashSession, DateOnly? from, DateOnly? to, string? search,
            int? page, CommerceReads service, CancellationToken ct) =>
            service.HistoryAsync(kind, cashSession, from, to, search, page, ct)).Produces<CommercePage<EntryInfo>>();
        reads.MapGet("/documents/{id:guid}", async (Guid id, CommerceReads service, CancellationToken ct) =>
            Found(await service.DocumentAsync(id, ct))).Produces<EntryDocument>();
        reads.MapGet("/cash", (CommerceReads service, CancellationToken ct) => service.CashAsync(ct)).Produces<CashStatus>();
        reads.MapGet("/cash/sessions", (int? page, CommerceReads service, CancellationToken ct) =>
            service.CashSessionsAsync(page, ct)).Produces<CommercePage<CashInfo>>();
        reads.MapGet("/setup", (Guid businessId, CommerceReads service, CancellationToken ct) =>
            service.SetupAsync(businessId, ct)).Produces<SetupStatus>();
        reads.MapGet("/debts", (bool? paid, int? page, CommerceReads service, CancellationToken ct) =>
            service.DebtsAsync(paid, page, ct)).Produces<CommercePage<ReceivableInfo>>();
        reads.MapGet("/report", (Guid businessId, DateOnly? from, DateOnly? to, CommerceReads service, CancellationToken ct) =>
            service.ReportAsync(businessId, from, to, ct)).Produces<CommerceReport>();
        reads.MapGet("/commands/{id:guid}", StatusAsync).Produces<CommandResult>();
        reads.MapGet("/unconfirmed", (Guid businessId, KhypuPymeDbContext db, CancellationToken ct) =>
            db.Set<CommerceReceipt>().Where(x => x.BusinessId == businessId && x.AcknowledgedAt == null)
                .OrderBy(x => x.Id).Select(x => new CommandResult(x.Id, x.Kind, x.EntityId)).Take(50).ToArrayAsync(ct))
            .Produces<CommandResult[]>();
        if (!practice)
        {
            reads.MapGet("/export", CommerceExport.DownloadAsync);
            reads.MapGet("/audit", (int? page, KhypuPymeDbContext db, CancellationToken ct) =>
                CommerceReads.PageAsync(db.Set<CommerceAudit>().OrderByDescending(x => x.At).ThenBy(x => x.OperationId)
                    .Select(x => new AuditInfo(x.OperationId, x.AccountId, x.At, x.Kind, x.Reason, x.EntityId, x.Effect)), page, ct))
                .Produces<CommercePage<AuditInfo>>();
        }
        var writes = group.MapGroup("").AddEndpointFilter<CsrfFilter>();
        writes.MapPost("/commands", ExecuteAsync).Produces<CommandResult>();
        writes.MapPost("/commands/{id:guid}/ack", AcknowledgeAsync);
    }

    private static IResult Found<T>(T? result) where T : class => result is null ? Results.NotFound() : Results.Ok(result);

    private static async Task<IResult> ExecuteAsync(Guid businessId, CommerceCommand request, HttpContext http,
        CommerceService service, CancellationToken ct)
    {
        var practice = http.GetEndpoint()?.Metadata.GetMetadata<PracticeCommerce>() is not null;
        try { return Results.Ok(await service.ExecuteAsync(BusinessAccess.AccountId(http), businessId, request, practice, ct)); }
        catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
    }

    private static async Task<IResult> StatusAsync(Guid businessId, Guid id, KhypuPymeDbContext db, CancellationToken ct)
    {
        var found = await db.Set<CommerceReceipt>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.BusinessId == businessId, ct);
        return found is null ? Results.NotFound() : Results.Ok(new CommandResult(found.Id, found.Kind, found.EntityId));
    }

    private static async Task<IResult> AcknowledgeAsync(Guid businessId, Guid id, HttpContext http, BusinessAccess access,
        KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var owner = BusinessAccess.AccountId(http);
        await using var tx = await access.OpenAsync(owner, businessId, ct);
        await access.LockBusinessAsync(businessId, ct);
        var practice = http.GetEndpoint()?.Metadata.GetMetadata<PracticeCommerce>() is not null;
        if (!await db.Businesses.AnyAsync(x => x.Id == businessId && (x.PracticeOriginId != null) == practice, ct))
            return Results.NotFound();
        var found = await db.Set<CommerceReceipt>().SingleOrDefaultAsync(x => x.Id == id && x.BusinessId == businessId, ct);
        if (found is null) return Results.NotFound();
        if (found.AcknowledgedAt is null)
        {
            found.AcknowledgedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        return Results.NoContent();
    }
}

internal sealed class ReadCommerceScope(BusinessAccess access, KhypuPymeDbContext db) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var business = Guid.Parse((string)http.Request.RouteValues["businessId"]!);
        var ct = http.RequestAborted;
        var practice = http.GetEndpoint()?.Metadata.GetMetadata<PracticeCommerce>() is not null;
        http.Response.Headers.CacheControl = "no-store";
        await using var tx = await access.OpenAsync(BusinessAccess.AccountId(http), business, ct, IsolationLevel.RepeatableRead);
        var allowed = await db.Businesses.SingleOrDefaultAsync(x => x.Id == business && (x.PracticeOriginId != null) == practice, ct);
        if (allowed is null || await access.DeletingAsync(allowed.PracticeOriginId ?? allowed.Id, ct)) return Results.NotFound();
        try { return await next(context); }
        catch (CommerceFailure error) { return AuthErrors.Fail(error.Message, error.Status); }
    }
}
