using System.Data;
using System.Security.Claims;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace KhypuPyme.Api.Businesses;

internal sealed class BusinessAccess(KhypuPymeDbContext db)
{
    public static Guid AccountId(HttpContext http) =>
        Guid.Parse(http.User.FindFirstValue("sub") ?? http.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IDbContextTransaction> OpenAsync(Guid account, Guid? business, CancellationToken ct,
        IsolationLevel isolation = IsolationLevel.ReadCommitted)
    {
        var transaction = await db.Database.BeginTransactionAsync(isolation, ct);
        try
        {
            await SetAsync(account, business, ct);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public Task<int> LockSelectionAsync(Guid account, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({account.ToString()}, 2))", ct);

    public Task<int> LockBusinessAsync(Guid business, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({business.ToString()}, 3))", ct);

    public Task<int> SetAsync(Guid account, Guid? business, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT set_config('app.account_id', {account.ToString()}, true), set_config('app.business_id', {business?.ToString() ?? ""}, true)", ct);
}
