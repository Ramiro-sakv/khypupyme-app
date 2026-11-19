using System.Security.Cryptography;
using System.Text.Json;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Billing;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Businesses;

internal static class BusinessEndpoints
{
    public static void MapBusinesses(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/businesses").WithTags("Negocios").RequireAuthorization("Account");
        group.MapGet("/industries", () => TypedResults.Ok(Industries.All));
        group.MapGet("", GetPageAsync).Produces<BusinessPage>();
        group.MapGet("/last", GetLastAsync).Produces<SelectedBusiness>();
        group.MapGet("/{id:guid}", GetProfileAsync).Produces<BusinessProfile>();
        var writes = group.MapGroup("").AddEndpointFilter<CsrfFilter>();
        writes.MapPost("", CreateAsync).Produces<BusinessProfile>();
        writes.MapPut("/{id:guid}/selection", SelectAsync);
        writes.MapPut("/{id:guid}/settings", UpdateSettingsAsync);
    }

    private static async Task<IResult> GetPageAsync(string? search, int? page, HttpContext http,
        BusinessAccess access, KhypuPymeDbContext db, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        var number = page ?? 1;
        if (number < 1 || number > 1000 || search?.Length > 80)
            return AuthErrors.Fail("Selecciona una página válida y busca hasta 80 caracteres.");

        await using var transaction = await access.OpenAsync(BusinessAccess.AccountId(http), null, ct);
        var query = access.VisibleBusinesses().AsNoTracking().Where(item => item.PracticeOriginId == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var escaped = search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            query = query.Where(item => EF.Functions.ILike(item.Name, "%" + escaped + "%", "\\"));
        }

        const int pageSize = 20;
        var items = await query.OrderBy(item => item.Name).ThenBy(item => item.Id)
            .Skip((number - 1) * pageSize).Take(pageSize + 1)
            .Select(item => new BusinessCard(item.Id, item.Name, item.Industry)).ToArrayAsync(ct);
        return Results.Ok(new BusinessPage(items.Take(pageSize).ToArray(), items.Length > pageSize));
    }

    private static async Task<IResult> GetLastAsync(HttpContext http, BusinessAccess access, KhypuPymeDbContext db, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        var owner = BusinessAccess.AccountId(http);
        await using var transaction = await access.OpenAsync(owner, null, ct);
        var business = await (from selection in db.AccountSelections
                              join item in access.VisibleBusinesses() on new { selection.OwnerId, Id = selection.BusinessId }
                                equals new { item.OwnerId, item.Id }
                              where selection.OwnerId == owner && item.PracticeOriginId == null
                              select new BusinessCard(item.Id, item.Name, item.Industry)).FirstOrDefaultAsync(ct);
        return Results.Ok(new SelectedBusiness(business));
    }

    private static async Task<IResult> GetProfileAsync(Guid id, HttpContext http, BusinessAccess access,
        KhypuPymeDbContext db, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        await using var transaction = await access.OpenAsync(BusinessAccess.AccountId(http), id, ct);
        var business = await access.VisibleBusinesses().SingleOrDefaultAsync(x => x.Id == id && x.PracticeOriginId == null, ct);
        if (business is null) return Results.NotFound();
        var settings = await db.BusinessSettings.SingleAsync(x => x.BusinessId == id, ct);
        return Results.Ok(Profile(business, settings));
    }

    private static async Task<IResult> CreateAsync(NewBusiness input, HttpContext http, BusinessAccess access,
        KhypuPymeDbContext db, CancellationToken ct)
    {
        var name = input.Name?.Trim();
        var industry = input.Industry;
        var city = input.City?.Trim() ?? "";
        var phone = input.Phone?.Trim() ?? "";
        var units = input.TimberUnits;
        if (name is not { Length: > 0 and <= 100 } || name.Any(char.IsControl) ||
            industry is null || !Industries.All.Any(item => item.Id == industry) || input.Id == Guid.Empty)
            return AuthErrors.Fail("Indica un nombre y un rubro válidos.");
        if (!ValidSettings(industry, city, phone, units))
            return AuthErrors.Fail("Revisa la ciudad, el teléfono y las unidades del rubro.");

        var owner = BusinessAccess.AccountId(http);
        // El mismo UUID y contenido recuperan el alta original aunque la ficha haya cambiado.
        var normalized = new NewBusiness(input.Id, name, industry, city, phone, units);
        var digest = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(normalized)));
        await using var transaction = await access.OpenAsync(owner, input.Id, ct);
        await access.LockSelectionAsync(owner, ct);
        if (await access.ClosedAsync(owner, ct)) return AuthErrors.Fail("La cuenta tiene una solicitud de eliminación.", 403);
        if (await access.DeletingAsync(input.Id, ct)) return AuthErrors.Fail("Ese identificador corresponde a un negocio retirado.", 409);
        var existing = await db.Businesses.SingleOrDefaultAsync(x => x.Id == input.Id, ct);
        if (existing is not null)
        {
            if (existing.CreationDigest != digest) return AuthErrors.Fail("Ese identificador ya corresponde a otra solicitud.", 409);
            var saved = await db.BusinessSettings.SingleAsync(x => x.BusinessId == input.Id, ct);
            return Results.Ok(Profile(existing, saved));
        }

        var business = new Business { Id = input.Id, OwnerId = owner, Name = name, Industry = industry, CreationDigest = digest };
        var settings = new BusinessSettings { BusinessId = input.Id, OwnerId = owner, City = city, Phone = phone, TimberUnits = units };
        db.Businesses.Add(business);
        db.BusinessSettings.Add(settings);
        if (!await db.Set<AccountTrial>().AnyAsync(x => x.OwnerId == owner, ct))
            db.Add(new AccountTrial { OwnerId = owner, FirstBusinessId = input.Id });
        await SetSelectionAsync(db, owner, input.Id, ct);
        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateException error) when (error.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            return AuthErrors.Fail("Ese identificador ya corresponde a otra solicitud.", 409);
        }
        return Results.Ok(Profile(business, settings));
    }

    private static async Task<IResult> SelectAsync(Guid id, HttpContext http, BusinessAccess access,
        KhypuPymeDbContext db, CancellationToken ct)
    {
        var owner = BusinessAccess.AccountId(http);
        await using var transaction = await access.OpenAsync(owner, id, ct);
        await access.LockSelectionAsync(owner, ct);
        await access.LockBusinessAsync(id, ct);
        if (!await access.VisibleBusinesses().AnyAsync(x => x.Id == id && x.PracticeOriginId == null, ct)) return Results.NotFound();
        await SetSelectionAsync(db, owner, id, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateSettingsAsync(Guid id, SettingsInput input, HttpContext http,
        BusinessAccess access, KhypuPymeDbContext db, CancellationToken ct)
    {
        if (input.BusinessId != id) return AuthErrors.Fail("La configuración pertenece a otro negocio.");
        await using var transaction = await access.OpenAsync(BusinessAccess.AccountId(http), id, ct);
        await access.LockBusinessAsync(id, ct);
        var business = await access.VisibleBusinesses().SingleOrDefaultAsync(x => x.Id == id && x.PracticeOriginId == null, ct);
        if (business is null) return Results.NotFound();

        var city = input.City?.Trim() ?? "";
        var phone = input.Phone?.Trim() ?? "";
        if (!ValidSettings(business.Industry, city, phone, input.TimberUnits))
            return AuthErrors.Fail("Revisa la ciudad, el teléfono y las unidades del rubro.");
        var settings = await db.BusinessSettings.SingleAsync(x => x.BusinessId == id, ct);
        settings.City = city;
        settings.Phone = phone;
        settings.TimberUnits = input.TimberUnits;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    private static async Task SetSelectionAsync(KhypuPymeDbContext db, Guid owner, Guid id, CancellationToken ct)
    {
        var record = await db.AccountSelections.FindAsync([owner], ct);
        if (record is null) db.AccountSelections.Add(new AccountSelection { OwnerId = owner, BusinessId = id });
        else record.BusinessId = id;
    }

    private static BusinessProfile Profile(Business business, BusinessSettings settings) =>
        new(business.Id, business.Name, business.Industry, settings.City, settings.Phone, settings.TimberUnits, settings.Policy());

    private static bool ValidSettings(string industry, string city, string phone, string? units) =>
        city.Length <= 80 && phone.Length <= 32 && !city.Any(char.IsControl) && !phone.Any(char.IsControl) &&
        (industry == "timber" ? units is "imperial" or "metric" : units is null);
}
