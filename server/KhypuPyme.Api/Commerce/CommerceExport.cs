using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Services;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace KhypuPyme.Api.Commerce;

internal static class CommerceExport
{
    public static async Task<IResult> DownloadAsync(Guid businessId, KhypuPymeDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var profile = await (from business in db.Businesses
                             join settings in db.BusinessSettings on business.Id equals settings.BusinessId
                             where business.Id == businessId
                             select new BusinessProfile(business.Id, business.Name, business.Industry, settings.City, settings.Phone, settings.TimberUnits,
                                 new OperatingPolicy(settings.PolicyRevision, settings.DefaultPayment, settings.MaxDiscountPercent,
                                     settings.QuoteDays, settings.AllowNewCredit, settings.LotAlertDays)))
            .SingleAsync(ct);

        var data = new
        {
            version = 1,
            exportedAt = clock.GetUtcNow(),
            business = profile,
            products = await Rows<Product>(),
            customers = await Rows<Customer>(),
            operations = await db.Set<Entry>().AsNoTracking().Where(x => x.BusinessId == businessId)
                .OrderBy(x => x.Sequence).Include(x => x.Lines).ToArrayAsync(ct),
            cashSessions = await Rows<CashSession>(),
            receivables = await Rows<Receivable>(),
            timberStock = await Rows<TimberStock>(),
            lots = await Rows<RetailLot>(),
            equipment = await Rows<EquipmentUnit>(),
            equipmentMovements = await Rows<EquipmentMovement>(),
            containerTypes = await Rows<ContainerType>(),
            containerBalances = await Rows<ContainerBalance>(),
            containerMovements = await Rows<ContainerMovement>(),
            partReferences = await Rows<PartReference>(),
            vehicleFitments = await Rows<ProductFitment>(),
            deliveries = await Rows<FurnitureDelivery>(),
            work = await Rows<WorkItem>(),
            audit = await Rows<CommerceAudit>(),
        };
        return Results.Json(data);

        Task<T[]> Rows<T>() where T : class, IBusinessRecord =>
            db.Set<T>().AsNoTracking().Where(x => x.BusinessId == businessId).ToArrayAsync(ct);
    }
}
