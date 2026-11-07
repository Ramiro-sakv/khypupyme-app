import type { UnitOfWork } from "./UnitOfWork.js";
import type { TradeService } from "./TradeService.js";
import type {
  Appointment,
  ContainerBalance,
  ContainerType,
  Delivery,
  OperationalAction,
  WorkOrder,
  WorkStatus,
} from "../../../shared/workspace/operations.js";
import {
  hasAgenda,
  hasDelivery,
  workKindFor,
} from "../../../shared/workspace/operations.js";
import type {
  Customer,
  WorkspaceBusiness,
} from "../../../shared/workspace/model.js";
import { today } from "../../../shared/commerce.js";

type Slot = { id: string; startAt: string; endAt: string };
export class OperationalService {
  constructor(
    private readonly work: UnitOfWork,
    private readonly business: WorkspaceBusiness,
    private readonly operationId: string,
  ) {}
  private async customer(id: string) {
    const c = await this.work.get<Customer>("customersV2", id);
    if (!c || !c.active)
      throw new Error("Selecciona un cliente activo de este negocio.");
    return c;
  }
  private revision(
    old: { revision: number; saleId?: string } | null,
    id: string,
    expected: number,
  ) {
    if (id && !old) throw new Error("No existe el registro en este negocio.");
    if ((old?.revision ?? 0) !== expected)
      throw new Error("El registro cambió. Actualiza antes de guardar.");
    if (old?.saleId)
      throw new Error("El trabajo ya tiene una venta confirmada.");
  }
  private audit(kind: string, id: string, revision: number, snapshot: object) {
    this.work.set("workflowEvents", this.operationId, {
      id: this.operationId,
      kind,
      recordId: id,
      revision,
      snapshot,
      authorUid: this.work.uid,
      date: today(),
      createdAt: this.work.now,
    });
  }
  private async appointment(
    input: Extract<OperationalAction, { kind: "appointment" }>["input"],
  ) {
    if (!hasAgenda(this.business.industryId))
      throw new Error("Este rubro no dispone de agenda.");
    const old = input.id
      ? await this.work.get<Appointment>("appointments", input.id)
      : null;
    this.revision(old, input.id, input.expectedRevision);
    if (!old && input.status !== "scheduled")
      throw new Error("Una cita nueva empieza programada.");
    if (old && ["cancelled", "no-show"].includes(old.status))
      throw new Error("La cita terminó. Crea una cita nueva.");
    if (
      input.startAt.slice(0, 10) !== input.endAt.slice(0, 10) ||
      Date.parse(input.endAt) <= Date.parse(input.startAt) ||
      Date.parse(input.endAt) - Date.parse(input.startAt) > 12 * 3600000
    )
      throw new Error(
        "La cita debe durar entre un minuto y doce horas dentro del mismo día.",
      );
    const c = await this.customer(input.customerId),
      id = old?.id ?? this.operationId;
    // Un documento por día serializa también dos reservas de una agenda vacía.
    const days = new Set([
      input.startAt.slice(0, 10),
      ...(old ? [old.startAt.slice(0, 10)] : []),
    ]);
    for (const day of days) {
      const calendar = await this.work.get<{ slots: Slot[] }>(
          "calendarDays",
          day,
        ),
        slots = (calendar?.slots ?? []).filter((s) => s.id !== id);
      if (
        day === input.startAt.slice(0, 10) &&
        ["scheduled", "attended"].includes(input.status)
      ) {
        if (slots.length >= 100)
          throw new Error("La agenda de ese día alcanzó 100 citas.");
        if (
          slots.some((s) => s.startAt < input.endAt && s.endAt > input.startAt)
        )
          throw new Error(
            "Ese horario se cruza con otra cita. Escoge un horario libre.",
          );
        slots.push({ id, startAt: input.startAt, endAt: input.endAt });
      }
      this.work.set("calendarDays", day, { slots, updatedAt: this.work.now });
    }
    const { expectedRevision: _, ...data } = input;
    void _;
    const value: Appointment = {
      ...data,
      id,
      customerName: c.name,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? this.work.now,
      updatedAt: this.work.now,
    };
    this.work.set("appointments", id, {
      ...value,
      date: input.startAt.slice(0, 10),
    });
    this.audit("appointment", id, value.revision, value);
    return id;
  }
  private async order(
    input: Extract<OperationalAction, { kind: "work-order" }>["input"],
  ) {
    if (workKindFor(this.business.industryId) !== input.kind)
      throw new Error("Este tipo de orden no corresponde al rubro.");
    const old = input.id
      ? await this.work.get<WorkOrder>("workOrders", input.id)
      : null;
    this.revision(old, input.id, input.expectedRevision);
    if (!old && (input.status !== "received" || input.expectedRevision !== 0))
      throw new Error("Una orden nueva empieza recibida.");
    const next: Record<WorkStatus, WorkStatus[]> = {
      received: ["diagnosis", "quoted", "approved", "cancelled"],
      diagnosis: ["quoted", "cancelled"],
      quoted: ["approved", "cancelled"],
      approved: ["in-progress", "cancelled"],
      "in-progress": ["ready", "cancelled"],
      ready: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };
    if (
      old &&
      (old.kind !== input.kind ||
        ["delivered", "cancelled"].includes(old.status) ||
        (old.status !== input.status &&
          !next[old.status].includes(input.status)))
    )
      throw new Error("La transición de la orden no está permitida.");
    const c = await this.customer(input.customerId),
      id = old?.id ?? this.operationId,
      { expectedRevision: _, ...data } = input;
    void _;
    const value: WorkOrder = {
      ...data,
      id,
      customerName: c.name,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? this.work.now,
      updatedAt: this.work.now,
    };
    this.work.set("workOrders", id, value);
    this.audit("work-order", id, value.revision, value);
    return id;
  }
  private async delivery(
    input: Extract<OperationalAction, { kind: "delivery" }>["input"],
  ) {
    if (!hasDelivery(this.business.industryId))
      throw new Error("Este rubro no dispone de entregas.");
    const old = input.id
      ? await this.work.get<Delivery>("deliveries", input.id)
      : null;
    // saleId es el vínculo comercial, no la marca de facturación de una orden.
    if ((old?.revision ?? 0) !== input.expectedRevision || (input.id && !old))
      throw new Error("La entrega cambió. Actualiza el listado.");
    const sale = await this.work.get<{ status: string }>(
      "salesV2",
      input.saleId,
    );
    if (!sale || sale.status !== "active")
      throw new Error("Selecciona una venta activa de este negocio.");
    if (
      old &&
      (old.saleId !== input.saleId ||
        ["delivered", "cancelled"].includes(old.status))
    )
      throw new Error("No se puede modificar esta entrega.");
    const permitted = {
      pending: ["prepared", "cancelled"],
      prepared: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    } as Record<Delivery["status"], string[]>;
    if (!old) {
      if (
        input.status !== "pending" ||
        (await this.work.get("deliverySaleIndex", input.saleId))
      )
        throw new Error(
          "La venta ya tiene entrega o el estado inicial es incorrecto.",
        );
    } else if (
      old.status !== input.status &&
      !permitted[old.status].includes(input.status)
    )
      throw new Error("Transición de entrega no permitida.");
    const id = old?.id ?? this.operationId,
      { expectedRevision: _, ...data } = input;
    void _;
    const value: Delivery = {
      ...data,
      id,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? this.work.now,
      updatedAt: this.work.now,
    };
    this.work.set("deliveries", id, value);
    this.work.set("deliverySaleIndex", input.saleId, { id });
    this.audit("delivery", id, value.revision, value);
    return id;
  }
  async execute(action: OperationalAction, trade: TradeService) {
    switch (action.kind) {
      case "appointment":
        return { id: await this.appointment(action.input) };
      case "work-order":
        return { id: await this.order(action.input) };
      case "delivery":
        return { id: await this.delivery(action.input) };
      case "container-type": {
        if (this.business.industryId !== "beverages")
          throw new Error("El control de envases pertenece a bebidas.");
        this.work.set("containerTypes", this.operationId, {
          id: this.operationId,
          name: action.input.name,
          unit: action.input.unit,
          owned: action.input.quantity,
          available: action.input.quantity,
          createdAt: this.work.now,
        });
        this.work.set("containerMovements", this.operationId, {
          id: this.operationId,
          containerId: this.operationId,
          kind: "opening",
          quantity: action.input.quantity,
          reason: "Alta de envases propios",
          authorUid: this.work.uid,
          createdAt: this.work.now,
        });
        return { id: this.operationId };
      }
      case "container-move": {
        if (this.business.industryId !== "beverages")
          throw new Error("El control de envases pertenece a bebidas.");
        const i = action.input,
          c = await this.customer(i.customerId),
          type = await this.work.get<ContainerType>(
            "containerTypes",
            i.containerId,
          );
        if (!type) throw new Error("No existe ese tipo de envase.");
        const id = i.containerId + "_" + i.customerId,
          old = await this.work.get<ContainerBalance>("containerBalances", id),
          quantity = old?.quantity ?? 0;
        if (
          (i.direction === "out" && type.available < i.quantity) ||
          (i.direction === "in" && quantity < i.quantity)
        )
          throw new Error(
            "La cantidad supera los envases disponibles o pendientes del cliente.",
          );
        const delta = i.direction === "out" ? i.quantity : -i.quantity;
        this.work.set("containerTypes", type.id, {
          ...type,
          available: type.available - delta,
        });
        this.work.set("containerBalances", id, {
          id,
          containerId: type.id,
          customerId: c.id,
          customerName: c.name,
          name: type.name,
          quantity: quantity + delta,
          createdAt: old?.createdAt ?? this.work.now,
        });
        this.work.set("containerMovements", this.operationId, {
          id: this.operationId,
          ...i,
          customerName: c.name,
          name: type.name,
          authorUid: this.work.uid,
          createdAt: this.work.now,
        });
        return { id: this.operationId };
      }
      case "operational-sale": {
        const i = action.input,
          resource =
            i.sourceKind === "appointment" ? "appointments" : "workOrders";
        if (
          (i.sourceKind === "appointment" &&
            !hasAgenda(this.business.industryId)) ||
          (i.sourceKind === "work-order" &&
            !workKindFor(this.business.industryId))
        )
          throw new Error("Origen no disponible para este rubro.");
        const source = await this.work.get<Appointment | WorkOrder>(
          resource,
          i.sourceId,
        );
        this.revision(source, i.sourceId, i.expectedRevision);
        if (
          !source ||
          !["attended", "ready", "delivered"].includes(source.status)
        )
          throw new Error(
            "Completa la atención o deja el trabajo listo antes de vender.",
          );
        if (
          source.customerId !== i.sale.customerId ||
          source.customerName !== i.sale.customerName
        )
          throw new Error("La venta debe conservar el cliente de la atención.");
        const result = await trade.sale(i.sale);
        this.work.set(resource, source.id, {
          ...source,
          saleId: result.sale.id,
          revision: source.revision + 1,
          updatedAt: this.work.now,
        });
        this.work.set("salesV2", result.sale.id, {
          ...result.sale,
          origin: { kind: i.sourceKind, id: source.id },
        });
        this.audit("operational-sale", source.id, source.revision + 1, {
          saleId: result.sale.id,
        });
        return { id: result.sale.id, document: result.document };
      }
    }
  }
}
