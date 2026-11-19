using System.Text.Json;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Security;

internal static class CorrectionAudit
{
    public static bool Protected(CommerceCommand command) => command.Kind switch
    {
        "return" or "exchange" or "void-expense" or "void-debt" or "cash-adjust" or "stock-in" or "stock-loss" or "inspection" or "hold-lot" or "release-lot" or
            "discard-lot" or "open-cement" or "configure-business" => true,
        "advance-work" => command.WorkState == "cancelled",
        "product" or "customer" => command.EntityId is not null,
        _ => false,
    };

    public static Task<bool> CashDifferenceAsync(KhypuPymeDbContext db, CommerceCommand command, CancellationToken ct) =>
        command.Kind == "close-cash" && command.SourceId is Guid id
            ? db.Set<CashSession>().AnyAsync(x => x.Id == id && x.ClosedAt == null && x.ExpectedMinor != command.AmountMinor, ct)
            : Task.FromResult(false);

    public static async Task<object?> BeforeAsync(CommerceTransaction work)
    {
        if (work.Command.Kind == "configure-business")
            return (await work.SettingsAsync()).Policy();
        if (work.Command is { Kind: "product", EntityId: Guid product })
        {
            var item = await work.ProductAsync(product);
            return new { item.Name, item.Code, item.PriceMinor, item.Active, item.SuperShortMinor, item.ShortMinor, item.LongMinor };
        }
        if (work.Command is { Kind: "customer", EntityId: Guid customer })
        {
            var item = await work.CustomerAsync(customer);
            return new { item.Name, item.Phone };
        }
        if (work.Command.Kind == "cash-adjust" && await work.OpenCashAsync() is { } session)
            return new { session.Id, session.ExpectedMinor };
        return null;
    }

    public static void Record(CommerceTransaction work, Guid account, Guid entity, string reason, object? previous)
    {
        var command = work.Command;
        // La solicitud comercial contiene datos de la operación. Las credenciales viajan por otro contrato.
        var change = JsonSerializer.Serialize(new { Previous = previous, Command = command });
        work.Db.Add(new CommerceAudit
        {
            BusinessId = work.Business.Id, OperationId = command.OperationId, AccountId = account,
            At = work.Now, Kind = command.Kind, Reason = reason, EntityId = entity, Effect = change,
        });
    }
}
