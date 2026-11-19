using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Retail;

public sealed record ContainerInput(Guid TypeId, int Delivered, int Returned);
public sealed record ContainerInfo(Guid TypeId, string Name, int Available, int Borrowed, int CustomerBalance);
public sealed record ContainerMovementInfo(string Name, int Delivered, int Returned, int? CustomerBalance, int Available, int Added);

internal sealed class ContainerType : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Key { get; init; }
    public int Available { get; set; }
    public int Borrowed { get; set; }
}

internal sealed class ContainerBalance : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid TypeId { get; init; }
    public Guid CustomerId { get; init; }
    public int Quantity { get; set; }
}

internal sealed class ContainerMovement : IBusinessRecord
{
    public Guid BusinessId { get; init; }
    public Guid EntryId { get; init; }
    public Guid TypeId { get; init; }
    public required string Name { get; init; }
    public int Delivered { get; init; }
    public int Returned { get; init; }
    public int Added { get; init; }
    public int? CustomerBalance { get; init; }
    public int Available { get; init; }
}

internal sealed class ContainerService(CommerceTransaction work)
{
    public async Task<Guid> RegisterAsync()
    {
        RequireIndustry();
        var entry = await work.NewEntryAsync("ENV");
        var customer = await work.CustomerAsync(work.Command.CustomerId ?? Guid.Empty);
        entry.CustomerId = customer.Id;
        entry.CustomerName = customer.Name;
        await MoveAsync(entry, work.Command.Containers, required: true);
        return entry.Id;
    }

    public async Task<Guid> ReceiveStockAsync()
    {
        RequireIndustry();
        if (work.Command.StockQuantity is not int quantity || quantity is < 1 or > QuantityLimit)
            throw new CommerceFailure("Indica cuántos envases entran a disponibilidad.");
        ContainerType type;
        if (work.Command.EntityId is Guid id) type = await FindAsync(id);
        else
        {
            var name = Text(work.Command.Name, 80, "el nombre del envase", true);
            var key = name.ToUpperInvariant();
            if (await work.Db.Set<ContainerType>().AnyAsync(row => row.Key == key, work.Ct))
                throw new CommerceFailure("Ese tipo de envase ya existe. Registra la entrada en su ficha.", 409);
            type = work.Db.Add(new ContainerType { BusinessId = work.Business.Id, Id = work.Command.OperationId, Name = name, Key = key }).Entity;
        }
        if ((long)type.Available + type.Borrowed + quantity > QuantityLimit)
            throw new CommerceFailure("El total de envases de este tipo supera el límite.");
        type.Available += quantity;
        var entry = await work.NewEntryAsync("ENV");
        Record(entry, type, 0, 0, null, quantity);
        return entry.Id;
    }

    public async Task MoveAsync(Entry entry, ContainerInput[]? inputs, bool required = false)
    {
        if (!required && inputs is null) return;
        RequireIndustry();
        if (entry.CustomerId is not Guid customerId)
            throw new CommerceFailure("Elige un cliente registrado para controlar los envases.");
        if (inputs is not { Length: >= 1 and <= 20 } || inputs.Any(x => x is null || x.TypeId == Guid.Empty ||
            x.Delivered is < 0 or > QuantityLimit || x.Returned is < 0 or > QuantityLimit || x.Delivered + x.Returned == 0) ||
            inputs.Select(x => x.TypeId).Distinct().Count() != inputs.Length)
            throw new CommerceFailure("Indica hasta 20 tipos distintos de envases y sus cantidades enteras.");

        foreach (var line in inputs)
        {
            var type = await FindAsync(line.TypeId);
            var balance = await work.Db.Set<ContainerBalance>().FindAsync([entry.BusinessId, type.Id, customerId], work.Ct);
            var previous = balance?.Quantity ?? 0;
            if (line.Returned > previous)
                throw new CommerceFailure($"{type.Name}: el cliente tenía {previous} envases prestados y quieres devolver {line.Returned}.", 409);
            var available = type.Available + line.Returned;
            if (line.Delivered > available)
                throw new CommerceFailure($"{type.Name}: quedan {available} envases disponibles tras las devoluciones.", 409);

            balance ??= work.Db.Add(new ContainerBalance { BusinessId = entry.BusinessId, TypeId = type.Id, CustomerId = customerId }).Entity;
            balance.Quantity = previous - line.Returned + line.Delivered;
            type.Available = available - line.Delivered;
            type.Borrowed += line.Delivered - line.Returned;
            Record(entry, type, line.Delivered, line.Returned, balance.Quantity, 0);
        }
    }

    private async Task<ContainerType> FindAsync(Guid id) =>
        await work.Db.Set<ContainerType>().FindAsync([work.Business.Id, id], work.Ct)
        ?? throw new CommerceFailure("El tipo de envase no existe en este negocio.", 404);

    private void RequireIndustry()
    {
        if (work.Business.Industry != "beverages") throw new CommerceFailure("El control de envases corresponde al rubro de bebidas.");
    }

    private void Record(Entry entry, ContainerType type, int delivered, int received, int? balance, int added) =>
        work.Db.Add(new ContainerMovement { BusinessId = entry.BusinessId, EntryId = entry.Id, TypeId = type.Id, Name = type.Name,
            Delivered = delivered, Returned = received, Added = added, CustomerBalance = balance, Available = type.Available });

    public static Task<CommercePage<ContainerObligation>> ObligationsAsync(KhypuPymeDbContext db, string? search, int? page, CancellationToken ct)
    {
        var balances = db.Set<ContainerBalance>().AsNoTracking();
        var term = CommerceReads.Search(search);
        var customers = db.Set<Customer>().AsNoTracking();
        if (term is not null) customers = customers.Where(x => EF.Functions.ILike(x.Name, term, "\\") ||
            EF.Functions.ILike(x.Phone, term, "\\") || x.Code != null && EF.Functions.ILike(x.Code, term, "\\"));
        var rows = from balance in balances
                   join customer in customers on new { balance.BusinessId, Id = balance.CustomerId } equals new { customer.BusinessId, customer.Id }
                   join type in db.Set<ContainerType>().AsNoTracking() on new { balance.BusinessId, Id = balance.TypeId } equals new { type.BusinessId, type.Id }
                   where balance.Quantity > 0
                   orderby customer.Name, customer.Id, type.Name, type.Id
                   select new ContainerObligation(customer.Id, customer.Name, type.Id, type.Name, balance.Quantity);
        return CommerceReads.PageAsync(rows, page, ct);
    }

    public static Task<ContainerInfo[]> ListAsync(Guid? customer, KhypuPymeDbContext db, CancellationToken ct)
    {
        var balances = db.Set<ContainerBalance>().AsNoTracking();
        return db.Set<ContainerType>().AsNoTracking().OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Select(row => new ContainerInfo(row.Id, row.Name, row.Available, row.Borrowed, customer == null ? 0 :
                balances.Where(x => x.BusinessId == row.BusinessId && x.TypeId == row.Id && x.CustomerId == customer)
                    .Select(x => x.Quantity).SingleOrDefault())).ToArrayAsync(ct);
    }
}

public sealed record ContainerObligation(Guid CustomerId, string CustomerName, Guid TypeId, string ContainerName, int Quantity);
