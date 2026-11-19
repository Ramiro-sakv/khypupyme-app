using System.Security.Cryptography;
using System.Text.Json;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Billing;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Commerce;

internal sealed class CommerceService(KhypuPymeDbContext db, BusinessAccess access, LicenseAccess license, TimeProvider clock)
{
    public async Task<CommandResult> ExecuteAsync(Guid accountId, Guid businessId, CommerceCommand command, bool practiceChannel, CancellationToken ct)
    {
        if (command.OperationId == Guid.Empty || command.Kind is null or { Length: > 30 })
            throw new CommerceFailure("La solicitud comercial no es válida.");
        if (command.Containers is not null && command.Kind is not ("sale" or "containers"))
            throw new CommerceFailure("Registra los envases en una venta o en su movimiento independiente.");
        if ((command.WorkLink is not null && command.Kind is not ("save-work" or "advance-work" or "repair-receipt" or "sale")) ||
            (command.Work is not null && command.Kind != "save-work") || (command.WorkState is not null && command.Kind != "advance-work") ||
            (command.ServiceProduct is not null && command.Kind != "product"))
            throw new CommerceFailure("Los datos de la cita o servicio no corresponden a la operación.");

        await using var transaction = await access.OpenAsync(accountId, businessId, ct);
        var business = await db.Businesses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == businessId &&
            (x.PracticeOriginId != null) == practiceChannel, ct)
            ?? throw new CommerceFailure("No se encontró el negocio.", 404);

        // Orden fijo de bloqueos: identificador de cuenta, luego el negocio.
        var requestKey = accountId.ToString("N") + command.OperationId.ToString("N");
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({requestKey}, 4))", ct);
        var digest = Digest(command);
        var receipt = await db.Set<CommerceReceipt>().FindAsync([accountId, command.OperationId], ct);
        if (receipt is not null)
        {
            if (receipt.BusinessId != businessId || receipt.Digest != digest)
                throw new CommerceFailure("Ese identificador ya se utilizó con otra solicitud.", 409);
            return new CommandResult(receipt.Id, receipt.Kind, receipt.EntityId);
        }

        await access.LockBusinessAsync(businessId, ct);
        var now = clock.GetUtcNow();
        if (command.Kind != "close-cash")
            await license.RequireAsync(accountId, business.PracticeOriginId ?? businessId, now, ct);
        var practice = practiceChannel
            ? await db.Set<TimberPractice>().SingleOrDefaultAsync(x => x.SandboxId == businessId, ct)
            : null;
        if (practiceChannel && practice?.State != "active")
            throw new CommerceFailure("Reanuda la práctica antes de registrar movimientos.", 409);
        var work = new CommerceTransaction(db, business, command, now, ct);
        var entityId = command.Kind switch
        {
            "product" => await SaveProductAsync(work),
            "customer" => await SaveCustomerAsync(work),
            "purchase" => await new TradeOperations(work).PurchaseAsync(),
            "sale" or "quote" => await new TradeOperations(work).SellAsync(),
            "return" or "exchange" => await new TradeOperations(work).ReturnAsync(),
            "inspection" => await new EquipmentInventory(work).InspectAsync(),
            "containers" => await new ContainerService(work).RegisterAsync(),
            "container-stock" => await new ContainerService(work).ReceiveStockAsync(),
            "open-cement" => await new CementOperations(work).OpenAsync(),
            "schedule-delivery" or "complete-delivery" => await new FurnitureDeliveries(work).ExecuteAsync(),
            "save-work" => await new WorkOperations(work).SaveAsync(),
            "advance-work" => await new WorkOperations(work).TransitionAsync(),
            "repair-receipt" => await new WorkOperations(work).ReceiveAsync(),
            "hold-lot" or "release-lot" or "discard-lot" => await new RetailInventory(work).CorrectLotAsync(),
            "stock-loss" => await new TradeOperations(work).LossAsync(),
            "open-cash" or "close-cash" or "expense" or "void-expense" or "collect"
                => await new CashOperations(work).ExecuteAsync(),
            _ => throw new CommerceFailure("El tipo de operación no es válido."),
        };

        if (practice is not null) PracticeSteps.Advance(practice, work);
        db.Add(new CommerceReceipt
        {
            Id = command.OperationId, AccountId = accountId, BusinessId = businessId,
            Digest = digest, Kind = command.Kind, EntityId = entityId,
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new CommandResult(command.OperationId, command.Kind, entityId);
    }

    private static string Digest(CommerceCommand command)
    {
        // Los contratos anteriores mantienen sus huellas, incluso cuando se agregan campos opcionales.
        bool specialized = command.RetailProduct is not null || command.ApparelProduct is not null || command.EquipmentProduct is not null ||
            command.ExchangeLines is not null || command.Serial is not null || command.Release is not null ||
            command.Lines?.Any(x => x?.Measure is not null || x?.Serials is not null) == true;
        var timber = command.TimberProduct is not null || command.Lines?.Any(x => x?.Timber is not null || x?.OriginalLineId is not null) == true;
        bool extended = command.CosmeticProduct is not null || command.Containers is not null || command.StockQuantity is not null ||
            command.Lines?.Any(x => x?.Measure?.Loose is not null) == true;
        var current = command.DetailProduct is not null || command.PartsProduct is not null || command.PrintingProduct is not null ||
            command.RetailProduct?.RollLength is not null ||
            command.Lines?.Any(x => x?.Printing is not null) == true ||
            command.ExchangeLines?.Any(x => x?.Printing is not null) == true;
        object? oldRetail = command.RetailProduct is { } retail ? new { retail.Unit, retail.BoxSize, retail.TrackLots, retail.Reorder } : null;
        var material = command.FurnitureProduct is not null || command.TileProduct is not null || command.CementProduct is not null ||
            command.Delivery is not null || command.Lines?.Any(x => x?.Tile is not null) == true ||
            command.ExchangeLines?.Any(x => x?.Tile is not null) == true;
        var service = command.ServiceProduct is not null || command.Work is not null || command.WorkLink is not null || command.WorkState is not null;
        object serialized = service ? command : material
            ? new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor, command.Active,
                command.Lines, command.TimberProduct, command.RetailProduct, command.ApparelProduct, command.EquipmentProduct,
                command.ExchangeLines, command.Serial, command.Release, command.CosmeticProduct, command.Containers, command.StockQuantity,
                command.DetailProduct, command.PartsProduct, command.PrintingProduct,
                command.FurnitureProduct, command.TileProduct, command.CementProduct, command.Delivery,
            }
            : current
            ? new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor, command.Active,
                Lines = command.Lines?.Select(SpecialtyLine), command.TimberProduct, command.RetailProduct, command.ApparelProduct,
                command.EquipmentProduct, ExchangeLines = command.ExchangeLines?.Select(SpecialtyLine), command.Serial, command.Release,
                command.CosmeticProduct, command.Containers, command.StockQuantity, command.DetailProduct, command.PartsProduct, command.PrintingProduct,
            }
            : extended
            ? new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor, command.Active,
                Lines = command.Lines?.Select(ExtendedLine), command.TimberProduct, RetailProduct = oldRetail, command.ApparelProduct,
                command.EquipmentProduct, ExchangeLines = command.ExchangeLines?.Select(ExtendedLine), command.Serial, command.Release,
                command.CosmeticProduct, command.Containers, command.StockQuantity,
            }
            : specialized
            ? new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor, command.Active,
                Lines = command.Lines?.Select(PreviousLine), command.TimberProduct, RetailProduct = oldRetail, command.ApparelProduct,
                command.EquipmentProduct, ExchangeLines = command.ExchangeLines?.Select(PreviousLine), command.Serial, command.Release,
            }
            : timber
            ? new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor, command.Active,
                Lines = command.Lines?.Select(x => x is null ? null : new { x.ProductId, x.Quantity, x.UnitMinor, x.Restock, x.Timber, x.OriginalLineId }),
                command.TimberProduct,
            }
            : new
            {
                command.OperationId, command.Kind, command.EntityId, command.CustomerId, command.SourceId, command.Name,
                command.Code, command.Phone, command.Method, command.Note, command.AmountMinor, command.DiscountMinor,
                command.Active, Lines = command.Lines?.Select(x => x is null ? null : new { x.ProductId, x.Quantity, x.UnitMinor, x.Restock }),
            };
        return Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(serialized)));

        static object? PreviousLine(CommandLine? line) => line is null ? null : new
        {
            line.ProductId, line.Quantity, line.UnitMinor, line.Restock, line.Timber, line.OriginalLineId,
            Measure = line.Measure is { } m ? new { m.Quantity, m.Unit, m.Lot, m.ExpiresOn } : null,
            line.Serials,
        };
        static object? ExtendedLine(CommandLine? line) => line is null ? null : new
        {
            line.ProductId, line.Quantity, line.UnitMinor, line.Restock, line.Timber, line.OriginalLineId, line.Measure, line.Serials,
        };
        static object? SpecialtyLine(CommandLine? line) => line is null ? null : new
        {
            line.ProductId, line.Quantity, line.UnitMinor, line.Restock, line.Timber, line.OriginalLineId, line.Measure, line.Serials, line.Printing,
        };
    }

    private static async Task<Guid> SaveProductAsync(CommerceTransaction work)
    {
        var input = work.Command;
        var name = Text(input.Name, 100, "el nombre del producto", true);
        var code = Text(input.Code, 40, "el código del producto", true);
        var normalizedCode = Text(code.ToUpperInvariant(), 40, "el código del producto", true);
        var price = Money(input.TimberProduct?.ShortMinor ?? input.AmountMinor, "un precio");
        var products = work.Db.Set<Product>();
        if (await products.AnyAsync(x => x.NormalizedCode == normalizedCode && x.Id != input.EntityId, work.Ct))
            throw new CommerceFailure("Ya existe un producto con ese código.", 409);

        Product product;
        if (input.EntityId is Guid existing)
        {
            product = await work.ProductAsync(existing);
            product.Name = name;
            product.Code = code;
            product.Active = input.Active ?? product.Active;
        }
        else
        {
            product = new Product { BusinessId = work.Business.Id, Id = input.OperationId, Name = name, Code = code,
                IsService = input.ServiceProduct == true };
            products.Add(product);
        }
        product.NormalizedCode = normalizedCode;
        TimberInventory.SetProfile(product, input.TimberProduct, work.Business.Industry == "timber", input.EntityId is null);
        await StoreProfiles.SaveAsync(work, product);
        await SpecialtyProfiles.SaveAsync(work, product);
        await MaterialProfiles.SaveAsync(work, product);
        if (input.ServiceProduct is bool service && service != product.IsService)
            throw new CommerceFailure("Crea otra ficha para cambiar entre producto y servicio.");
        if (product.IsService && (!WorkOperations.Supports(work.Business.Industry) || product.RetailUnit is not null ||
            product.Species is not null || product.Model is not null || product.WarrantyMonths is not null || product.PrintingSize is not null))
            throw new CommerceFailure("El servicio requiere una ficha sin control de inventario en un rubro de servicios.");
        product.PriceMinor = price;
        return product.Id;
    }

    private static async Task<Guid> SaveCustomerAsync(CommerceTransaction work)
    {
        var input = work.Command;
        var name = Text(input.Name, 100, "el nombre del cliente", true);
        var phone = Text(input.Phone, 32, "el teléfono");
        if (input.EntityId is Guid id)
        {
            var record = await work.CustomerAsync(id);
            record.Name = name;
            record.Phone = phone;
            return record.Id;
        }

        var customer = new Customer { BusinessId = work.Business.Id, Id = input.OperationId, Name = name, Phone = phone };
        work.Db.Add(customer);
        return customer.Id;
    }
}

internal sealed class CommerceTransaction(KhypuPymeDbContext db, Business business,
    CommerceCommand command, DateTimeOffset now, CancellationToken ct)
{
    public KhypuPymeDbContext Db => db;
    public Business Business => business;
    public CommerceCommand Command => command;
    public DateTimeOffset Now => now;
    public DateOnly Today => LocalDate(now);
    public CancellationToken Ct => ct;

    public async Task<Product> ProductAsync(Guid id) =>
        await db.Set<Product>().FindAsync([business.Id, id], ct)
        ?? throw new CommerceFailure("El producto no está disponible en este negocio.", 404);

    public async Task<Customer> CustomerAsync(Guid id) =>
        await db.Set<Customer>().FindAsync([business.Id, id], ct)
        ?? throw new CommerceFailure("El cliente no está disponible en este negocio.", 404);

    public async Task<Entry> SourceAsync(string kind, bool includeLines = false, bool allowExchange = false)
    {
        var query = db.Set<Entry>().Where(x => x.Id == command.SourceId && (x.Kind == kind || allowExchange && x.Kind == "exchange"));
        if (includeLines) query = query.Include(x => x.Lines);
        return await query.SingleOrDefaultAsync(ct)
            ?? throw new CommerceFailure("La operación de origen no está disponible en este negocio.", 404);
    }

    public async Task<Entry> NewEntryAsync(string prefix)
    {
        var sequence = (await db.Set<Entry>().MaxAsync(x => (long?)x.Sequence, ct) ?? 0) + 1;
        var entry = new Entry
        {
            BusinessId = business.Id, BusinessName = business.Name,
            Id = command.OperationId, Kind = command.Kind, Sequence = sequence,
            Number = $"{prefix}-{Today.Year}-{sequence:D6}", Date = Today, CreatedAt = now,
            Practice = business.PracticeOriginId is not null,
            Note = Text(command.Note, 240, "la referencia"),
            TimberUnits = business.Industry == "timber"
                ? await db.BusinessSettings.Where(x => x.BusinessId == business.Id).Select(x => x.TimberUnits).SingleAsync(ct)
                : null,
        };
        db.Add(entry);
        return entry;
    }

    public Task<CashSession?> OpenCashAsync() => db.Set<CashSession>().SingleOrDefaultAsync(x => x.ClosedAt == null, ct);

    public async Task ApplyCashAsync(Entry entry, long delta)
    {
        if (entry.Method != "cash") return;
        var session = await OpenCashAsync() ?? throw new CommerceFailure("Abre una caja para registrar efectivo.", 409);
        var balance = session.ExpectedMinor + delta;
        if (balance < 0)
            throw new CommerceFailure("El saldo de caja no alcanza para este pago en efectivo.", 409);
        session.ExpectedMinor = Money(balance, "un saldo de caja");
        entry.CashSessionId = session.Id;
        entry.CashDeltaMinor = delta;
    }
}
