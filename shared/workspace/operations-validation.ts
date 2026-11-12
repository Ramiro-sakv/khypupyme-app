import {
  date,
  identifier,
  list,
  money,
  object,
  oneOf,
  optionalId,
  text,
} from "./validation.js";
export const integer = (v: unknown, min = 0, max = 1000000): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw new Error("Cantidad o revisión fuera de límites.");
  return v;
};
const stamp = (v: unknown) => {
  const s = text(v, 25, 25);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-04:00$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new Error("Fecha y hora inválidas.");
  date(s.slice(0, 10));
  const h = Number(s.slice(11, 13)),
    m = Number(s.slice(14, 16));
  if (h > 23 || m > 59) throw new Error("Hora inválida.");
  return s;
};
type Decode = (v: unknown) => unknown;
export function present(raw: unknown, key: string, decode: Decode): Record<string, Decode> {
  return raw && typeof raw === "object" && Object.hasOwn(raw, key) ? { [key]: decode } : {};
}
export function saleExtras(raw: unknown) {
  return present(raw, "containers", list((v) => object(v, {
    containerId: identifier, delivered: (value) => integer(value), received: (value) => integer(value),
  }), 20));
}
export function operationalExtras(kind: string, raw: unknown) {
  if (kind === "appointment") return present(raw, "serviceId", identifier);
  if (kind === "delivery") return present(raw, "mode", oneOf(["pickup", "delivery"]));
  if (kind === "work-order") return present(raw, "particulars", (value) => {
    const fields = ["equipment", "accessories", "fault", "materialsPlanned", "materialsUsed", "deliverables", "specifications"];
    return object(value, Object.assign({}, ...fields.map((key) => present(value, key, (v) => text(v, 0, 500)))));
  });
  return {};
}
export function operationalSchemas(
  sale: Record<string, Decode>,
): Record<string, Record<string, Decode>> {
  const base = {
    id: optionalId,
    expectedRevision: (v: unknown) => integer(v),
    customerId: identifier,
    customerName: (v: unknown) => text(v, 2, 80),
  };
  return {
    appointment: {
      ...base,
      title: (v) => text(v, 2, 100),
      startAt: stamp,
      endAt: stamp,
      status: oneOf(["scheduled", "attended", "no-show", "cancelled"]),
    },
    "work-order": {
      ...base,
      kind: oneOf(["repair", "cutting", "cleaning", "professional", "craft"]),
      title: (v) => text(v, 2, 100),
      description: (v) => text(v, 3, 500),
      address: (v) => text(v, 0, 160),
      dueOn: date,
      checks: list((v) => text(v, 1, 120), 20, 0),
      budgetMinor: money,
      status: oneOf([
        "received",
        "diagnosis",
        "quoted",
        "approved",
        "in-progress",
        "waiting-parts",
        "ready",
        "delivered",
        "cancelled",
      ]),
    },
    delivery: {
      id: optionalId,
      expectedRevision: (v) => integer(v),
      saleId: identifier,
      address: (v) => text(v, 0, 160),
      scheduledOn: date,
      reference: (v) => text(v, 0, 120),
      status: oneOf(["pending", "prepared", "delivered", "cancelled"]),
    },
    "container-type": {
      name: (v) => text(v, 2, 80),
      unit: oneOf(["bottle", "crate"]),
      quantity: (v) => integer(v, 1),
    },
    "container-move": {
      containerId: identifier,
      customerId: identifier,
      direction: oneOf(["out", "in"]),
      quantity: (v) => integer(v, 1),
      reason: (v) => text(v, 3, 200),
    },
    "operational-document": { sourceId: identifier, sourceKind: oneOf(["work-order", "delivery"]) },
    "operational-sale": {
      sourceKind: oneOf(["appointment", "work-order"]),
      sourceId: identifier,
      expectedRevision: (v) => integer(v, 1),
      sale: (v) => object(v, { ...sale, ...saleExtras(v) }),
    },
  };
}
