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
        "ready",
        "delivered",
        "cancelled",
      ]),
    },
    delivery: {
      id: optionalId,
      expectedRevision: (v) => integer(v),
      saleId: identifier,
      address: (v) => text(v, 3, 160),
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
    "operational-sale": {
      sourceKind: oneOf(["appointment", "work-order"]),
      sourceId: identifier,
      expectedRevision: (v) => integer(v, 1),
      sale: (v) => object(v, sale),
    },
  };
}
