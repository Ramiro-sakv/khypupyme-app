using KhypuPyme.Api.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace KhypuPyme.Api.Health;

internal static class HealthEndpoints
{
    public static void MapHealthEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/api", ApiStatus).WithName("GetApiHealth");
        group.MapGet("/database", DatabaseStatusAsync).WithName("GetDatabaseHealth").Produces<HealthStatus>(StatusCodes.Status503ServiceUnavailable);
    }

    private static Ok<HealthStatus> ApiStatus(HttpContext http)
    {
        http.Response.Headers.CacheControl = "no-store";
        return TypedResults.Ok(new HealthStatus("available"));
    }

    private static async Task<Results<Ok<HealthStatus>, JsonHttpResult<HealthStatus>>> DatabaseStatusAsync(
        HttpContext http,
        KhypuPymeDbContext database,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        http.Response.Headers.CacheControl = "no-store";
        if (string.IsNullOrWhiteSpace(database.Database.GetConnectionString()))
        {
            return Unavailable("not-configured");
        }

        try
        {
            // Leer el catálogo valida el login y el permiso que concede la preparación local.
            var schemaReady = await database.Database.SqlQuery<bool>($"""
                SELECT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_namespace
                    WHERE nspname = {KhypuPymeDbContext.Schema}
                        AND has_schema_privilege(oid, 'USAGE')
                ) AS "Value"
                """).SingleAsync(cancellationToken);

            if (schemaReady)
            {
                return TypedResults.Ok(new HealthStatus("available"));
            }

            return Unavailable("schema-not-ready");
        }
        catch (Exception exception) when (exception is NpgsqlException or TimeoutException)
        {
            var logger = loggerFactory.CreateLogger("KhypuPyme.Api.Health");
            logger.LogWarning("PostgreSQL no disponible ({ErrorType}).", exception.GetType().Name);
            return Unavailable("unavailable");
        }
    }

    private static JsonHttpResult<HealthStatus> Unavailable(string status) =>
        TypedResults.Json(new HealthStatus(status), statusCode: StatusCodes.Status503ServiceUnavailable);
}

public sealed record HealthStatus(string Status);
