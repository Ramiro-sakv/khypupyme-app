using System.Text.Json;
using KhypuPyme.Api.Commerce;
using Microsoft.EntityFrameworkCore;
using static KhypuPyme.Api.Commerce.CommerceRules;

namespace KhypuPyme.Api.Services;

internal sealed class WorkOperations(CommerceTransaction work)
{
    public static bool Supports(string industry) => industry is "beauty" or "cleaning" or "professional" or "repair" or "crafts";

    public async Task<Guid> SaveAsync()
    {
        var industry = work.Business.Industry;
        var input = work.Command.Work;
        if (!Supports(industry) || input is null)
            throw new CommerceFailure("Indica los datos de la cita u orden de este rubro.");
        var editing = work.Command.WorkLink is not null;
        if (work.Command.CustomerId is not Guid customerId) throw new CommerceFailure("Elige un cliente registrado.");
        var customer = await work.CustomerAsync(customerId);
        var row = editing ? await LoadAsync(work.Command.WorkLink) :
            new WorkItem { BusinessId = work.Business.Id, Id = work.Command.OperationId, Industry = industry, Title = "", DetailsJson = "{}",
                State = industry == "repair" ? "received" : "scheduled" };
        if (row.State is "attended" or "delivered" or "no-show" or "cancelled" || row.SaleId is not null)
            throw new CommerceFailure("Este registro ya está atendido, cerrado o cobrado.", 409);
        if (input.Day == default || (input.Day < work.Today && (!editing || row.Day != input.Day)))
            throw new CommerceFailure("Indica una fecha desde hoy.");
        if (row.ReceiptId is not null && row.CustomerId != customer.Id)
            throw new CommerceFailure("La recepción ya tiene un cliente confirmado.", 409);
        if (input.ServiceId is Guid service)
        {
            var product = await work.ProductAsync(service);
            if (!product.IsService || (!product.Active && service != row.ServiceId))
                throw new CommerceFailure("Elige un servicio activo del catálogo.");
        }

        if (industry == "beauty")
        {
            if (input.ServiceId is null || input.StartMinute is not int start || start is < 0 or > 1439 ||
                input.Duration is not int duration || duration is < 5 or > 720 || start + duration > 1440)
                throw new CommerceFailure("Elige un servicio y una duración de 5 a 720 minutos dentro del mismo día.");
            if (await work.Db.Set<WorkItem>().AnyAsync(x => x.BusinessId == work.Business.Id && x.Industry == "beauty" &&
                x.Day == input.Day && x.Id != row.Id && x.State != "no-show" && x.State != "cancelled" && x.StartMinute < start + duration &&
                x.StartMinute + x.Duration > start, work.Ct))
                throw new CommerceFailure("Ese horario se cruza con otra cita. Elige otra hora o reprograma la cita existente.", 409);
        }
        else if (input.StartMinute is not null || input.Duration is not null)
            throw new CommerceFailure("La duración por horario corresponde a la agenda de peluquería.");

        var details = ValidateDetails(industry, input.Details ?? new(), row) with { StatusNote = WorkDetails.Read(row.DetailsJson).StatusNote };
        row.Title = Text(input.Title, 100, "el nombre del trabajo o cita", true);
        row.Day = input.Day;
        row.StartMinute = input.StartMinute;
        row.Duration = input.Duration;
        row.CustomerId = customer.Id;
        row.ServiceId = input.ServiceId;
        row.Address = industry == "cleaning" ? Text(input.Address, 240, "la dirección del trabajo", true) : null;
        if (row.State is not ("received" or "diagnosed" or "scheduled") && input.BudgetMinor != row.BudgetMinor)
            throw new CommerceFailure("El presupuesto ya quedó aprobado o el trabajo está en curso.", 409);
        row.BudgetMinor = input.BudgetMinor is long budget ? Money(budget, "un presupuesto válido") : null;
        row.DetailsJson = JsonSerializer.Serialize(details);
        row.Revision++;
        if (!editing) work.Db.Add(row);
        return row.Id;
    }

    public async Task<Guid> TransitionAsync()
    {
        var row = await LoadAsync(work.Command.WorkLink);
        var next = work.Command.WorkState;
        bool allowed = (row.Industry, row.State, next) switch
        {
            ("beauty", "scheduled", "attended" or "no-show") => row.Day <= work.Today,
            ("beauty", "scheduled", "cancelled") => true,
            ("repair", "working", "waiting-parts") or ("repair", "waiting-parts", "working") => true,
            ("repair", "received", "diagnosed") => !string.IsNullOrWhiteSpace(WorkDetails.Read(row.DetailsJson).Diagnosis),
            ("repair", "diagnosed", "approved") or ("professional", "scheduled", "approved") => row.BudgetMinor is not null,
            ("repair" or "professional", "approved", "working") => true,
            ("cleaning" or "crafts", "scheduled", "working") => true,
            (_, "working", "ready") or (_, "ready", "delivered") => true,
            _ => false,
        };
        if (!allowed) throw new CommerceFailure("Revisa el estado, la fecha y los datos del paso. Para aprobar, guarda primero el presupuesto.", 409);
        if (next is "waiting-parts" or "cancelled" || row.State == "waiting-parts")
        {
            var note = next is "waiting-parts" or "cancelled"
                ? Text(work.Command.Note, 240, next == "waiting-parts" ? "el repuesto pendiente" : "el motivo de cancelación", true)
                : null;
            row.DetailsJson = JsonSerializer.Serialize(WorkDetails.Read(row.DetailsJson) with { StatusNote = note });
        }
        row.State = next!;
        if (next == "delivered") row.DeliveredOn = work.Today;
        row.Revision++;
        return row.Id;
    }

    public async Task<Guid> ReceiveAsync()
    {
        var row = await LoadAsync(work.Command.WorkLink);
        if (row.Industry != "repair") throw new CommerceFailure("La constancia corresponde a una recepción de taller.");
        if (row.ReceiptId is Guid confirmed) return confirmed;
        var details = WorkDetails.Read(row.DetailsJson);
        var customer = await work.CustomerAsync(row.CustomerId);
        var entry = await work.NewEntryAsync("REC");
        entry.CustomerId = customer.Id;
        entry.CustomerName = customer.Name;
        entry.Note = string.Join("\n", row.Title, "Equipo: " + details.Equipment,
            "Accesorios recibidos: " + (string.IsNullOrEmpty(details.Accessories) ? "Ninguno declarado" : details.Accessories),
            "Falla declarada: " + details.Fault);
        row.ReceiptId = entry.Id;
        row.Revision++;
        return entry.Id;
    }

    public async Task<Guid> IssueReceiptAsync()
    {
        var row = await LoadAsync(work.Command.WorkLink);
        if (row.Industry is "beauty" or "repair")
            throw new CommerceFailure("La constancia de trabajo corresponde a una orden de limpieza, servicios profesionales o artesanía.");
        var customer = await work.CustomerAsync(row.CustomerId);
        var details = WorkDetails.Read(row.DetailsJson);
        var entry = await work.NewEntryAsync("ORD");
        entry.CustomerId = customer.Id;
        entry.CustomerName = customer.Name;
        entry.SourceId = row.SaleId;
        entry.Note = string.Join("\n", new[] {
            row.Title, "Fecha comprometida: " + row.Day.ToString("dd/MM/yyyy"),
            row.Address is null ? null : "Dirección: " + row.Address,
            row.DeliveredOn is DateOnly delivered ? "Entregada el " + delivered.ToString("dd/MM/yyyy") : null,
            row.Industry switch {
                "cleaning" => "Tareas: " + details.Tasks,
                "professional" => "Entregables: " + details.Deliverables,
                "crafts" => "Especificaciones: " + details.Specifications,
                _ => null,
            },
        }.OfType<string>());
        return entry.Id;
    }

    public async Task LinkSaleAsync(Entry sale, CommandLine[] lines)
    {
        if (work.Command.WorkLink is null) return;
        var row = await LoadAsync(work.Command.WorkLink, billing: true);
        if (row.State is not ("attended" or "ready" or "delivered"))
            throw new CommerceFailure("Marca la cita como atendida o la orden como lista antes de cobrar.", 409);
        if (sale.CustomerId != row.CustomerId)
            throw new CommerceFailure("La venta vinculada debe usar el cliente de la cita u orden.");
        if (row.ServiceId is Guid service && lines.Where(line => line.ProductId == service).Sum(line => line.Quantity) != 1)
            throw new CommerceFailure("Incluye exactamente una unidad del servicio de la cita u orden antes de confirmar.");
        row.SaleId = sale.Id;
        row.Revision++;
    }

    private async Task<WorkItem> LoadAsync(WorkRevision? link, bool billing = false)
    {
        if (link is null) throw new CommerceFailure("Elige una cita u orden.");
        var row = await work.Db.Set<WorkItem>().FindAsync([work.Business.Id, link.Id], work.Ct)
            ?? throw new CommerceFailure("La cita u orden no está disponible en este negocio.", 404);
        if (row.Industry != work.Business.Industry) throw new CommerceFailure("La orden no corresponde al rubro.");
        if (billing && row.SaleId is not null)
            throw new CommerceFailure("Este trabajo ya tiene una venta vinculada. Abre el comprobante original.", 409);
        if (row.Revision != link.Revision)
            throw new CommerceFailure("El registro cambió. Vuelve a abrirlo para consultar su estado y la venta vinculada.", 409);
        return row;
    }

    private static WorkDetails ValidateDetails(string industry, WorkDetails details, WorkItem row)
    {
        var saved = WorkDetails.Read(row.DetailsJson);
        return industry switch
        {
            "cleaning" => new(Tasks: Text(details.Tasks, 600, "las tareas del trabajo", true),
                PlannedMaterials: Text(details.PlannedMaterials, 600, "los materiales previstos"),
                UsedMaterials: Text(details.UsedMaterials, 600, "los materiales utilizados"),
                BillableMaterials: Text(details.BillableMaterials ?? saved.BillableMaterials, 600, "los materiales a cobrar"),
                InternalMaterials: Text(details.InternalMaterials ?? saved.InternalMaterials, 600, "los materiales de consumo interno")),
            "professional" => new(Deliverables: Text(details.Deliverables, 600, "los entregables", true)),
            "repair" => new(Equipment: row.ReceiptId is null ? Text(details.Equipment, 160, "el equipo recibido", true) : saved.Equipment,
                Accessories: row.ReceiptId is null ? Text(details.Accessories, 240, "los accesorios recibidos") : saved.Accessories,
                Fault: row.ReceiptId is null ? Text(details.Fault, 500, "la falla declarada", true) : saved.Fault,
                Diagnosis: Text(details.Diagnosis, 600, "el diagnóstico", row.State is not "received")),
            "crafts" => new(Specifications: Text(details.Specifications, 600, "las especificaciones del encargo", true)),
            _ => new(),
        };
    }
}
