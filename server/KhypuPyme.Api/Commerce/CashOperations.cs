using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class CashOperations(CommerceTransaction work)
{
    public Task<Guid> ExecuteAsync() => work.Command.Kind switch
    {
        "open-cash" => OpenAsync(),
        "close-cash" => CloseAsync(),
        "cash-adjust" => AdjustAsync(),
        "expense" => ExpenseAsync(),
        "void-expense" => VoidExpenseAsync(),
        "collect" => CollectAsync(),
        "manual-debt" => RegisterDebtAsync(),
        "void-debt" => VoidDebtAsync(),
        _ => throw new InvalidOperationException(),
    };

    private async Task<Guid> OpenAsync()
    {
        if (await work.OpenCashAsync() is not null)
            throw new CommerceFailure("Ya hay una caja abierta en el negocio.", 409);

        var opening = Money(work.Command.AmountMinor, "un fondo de apertura");
        var entry = await work.NewEntryAsync("APE");
        work.Db.Add(new CashSession
        {
            BusinessId = entry.BusinessId, Id = entry.Id, OpenedAt = work.Now,
            OpeningMinor = opening, ExpectedMinor = opening,
        });
        entry.CashSessionId = entry.Id;
        entry.TotalMinor = opening;
        return entry.Id;
    }

    private async Task<Guid> CloseAsync()
    {
        var session = await work.OpenCashAsync() ?? throw new CommerceFailure("No hay una caja abierta.", 409);
        if (session.Id != work.Command.SourceId)
            throw new CommerceFailure("La sesión de caja cambió. Vuelve a consultar.", 409);

        var counted = Money(work.Command.AmountMinor, "un efectivo contado");
        var entry = await work.NewEntryAsync("CIE");
        if (counted != session.ExpectedMinor)
            entry.Note = Text(work.Command.Note, 240, "el motivo de la diferencia", true);
        entry.TotalMinor = counted;
        entry.CashSessionId = session.Id;
        session.CountedMinor = counted;
        session.ClosedAt = work.Now;
        return entry.Id;
    }

    private async Task<Guid> ExpenseAsync()
    {
        var entry = await work.NewEntryAsync("GAS");
        entry.Note = Text(work.Command.Note, 240, "el concepto del gasto", true);
        entry.Method = Payment(work.Command.Method);
        entry.TotalMinor = entry.ExpensesMinor = Money(work.Command.AmountMinor, "un importe del gasto", positive: true);
        await work.ApplyCashAsync(entry, -entry.TotalMinor);
        return entry.Id;
    }

    private async Task<Guid> AdjustAsync()
    {
        var session = await work.OpenCashAsync() ?? throw new CommerceFailure("Abre caja antes de registrar un ajuste.", 409);
        if (session.Id != work.Command.SourceId)
            throw new CommerceFailure("La sesión de caja cambió. Vuelve a consultar.", 409);
        var direction = work.Command.Code switch
        {
            "in" => 1, "out" => -1,
            _ => throw new CommerceFailure("Elige aporte o retiro de efectivo.")
        };
        var entry = await work.NewEntryAsync(direction == 1 ? "APO" : "RET");
        entry.Note = Text(work.Command.Note, 240, "el motivo del ajuste de caja", true);
        entry.TotalMinor = Money(work.Command.AmountMinor, "un importe para el ajuste", positive: true);
        entry.Method = "cash";
        await work.ApplyCashAsync(entry, direction * entry.TotalMinor);
        return entry.Id;
    }

    private async Task<Guid> VoidExpenseAsync()
    {
        var original = await work.SourceAsync("expense");
        if (await work.Db.Set<Entry>().AnyAsync(x => x.Kind == "void-expense" && x.SourceId == original.Id, work.Ct))
            throw new CommerceFailure("El gasto ya fue anulado.", 409);

        var entry = await work.NewEntryAsync("ANG");
        entry.SourceId = original.Id;
        entry.Note = Text(work.Command.Note, 240, "el motivo de anulación", true);
        entry.Method = original.Method;
        entry.TotalMinor = original.TotalMinor;
        entry.ExpensesMinor = -entry.TotalMinor;
        await work.ApplyCashAsync(entry, entry.TotalMinor);
        return entry.Id;
    }

    private async Task<Guid> CollectAsync()
    {
        var sale = await work.SourceAsync("sale", allowManualDebt: true);
        var debt = await work.Db.Set<Receivable>().FindAsync([work.Business.Id, sale.Id], work.Ct);
        if (debt is null || debt.BalanceMinor <= 0)
            throw new CommerceFailure("El fiado ya no tiene saldo pendiente.", 409);
        if (work.Command.AmountMinor != debt.BalanceMinor)
            throw new CommerceFailure("El saldo cambió. Consulta el importe antes de cobrar.", 409);

        var entry = await work.NewEntryAsync("COB");
        entry.SourceId = sale.Id;
        entry.CustomerId = sale.CustomerId;
        entry.CustomerName = sale.CustomerName;
        entry.Method = Payment(work.Command.Method);
        entry.TotalMinor = debt.BalanceMinor;
        entry.DebtDeltaMinor = -debt.BalanceMinor;
        await work.ApplyCashAsync(entry, entry.TotalMinor);
        debt.BalanceMinor = 0;
        return entry.Id;
    }

    private async Task<Guid> RegisterDebtAsync()
    {
        if (!(await work.SettingsAsync()).AllowNewCredit)
            throw new CommerceFailure("El negocio tiene desactivados los fiados nuevos.");
        if (work.Command.CustomerId is not Guid customerId)
            throw new CommerceFailure("Selecciona un cliente registrado para el fiado.");
        var customer = await work.CustomerAsync(customerId);
        var entry = await work.NewEntryAsync("FIA");
        entry.Note = Text(work.Command.Note, 240, "el concepto del fiado", true);
        entry.Method = "credit";
        entry.CustomerId = customer.Id;
        entry.CustomerName = customer.Name;
        entry.TotalMinor = entry.DebtDeltaMinor = Money(work.Command.AmountMinor, "un importe para el fiado", positive: true);
        work.Db.Add(new Receivable
        {
            BusinessId = entry.BusinessId, SaleId = entry.Id, CustomerId = customer.Id,
            OriginalMinor = entry.TotalMinor, BalanceMinor = entry.TotalMinor,
        });
        return entry.Id;
    }

    private async Task<Guid> VoidDebtAsync()
    {
        var original = await work.SourceAsync("manual-debt");
        var debt = await work.Db.Set<Receivable>().FindAsync([work.Business.Id, original.Id], work.Ct);
        if (debt is null || debt.BalanceMinor <= 0)
            throw new CommerceFailure("El fiado manual ya fue saldado o anulado.", 409);
        var entry = await work.NewEntryAsync("ANF");
        entry.Note = Text(work.Command.Note, 240, "el motivo de anulación", true);
        entry.SourceId = original.Id;
        entry.CustomerId = original.CustomerId;
        entry.CustomerName = original.CustomerName;
        entry.TotalMinor = debt.BalanceMinor;
        entry.DebtDeltaMinor = -debt.BalanceMinor;
        debt.BalanceMinor = 0;
        return entry.Id;
    }
}
