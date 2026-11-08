import { exactDecimal } from "./timber-measures.js";
import { compare, decimal, ZERO } from "./exact.js";
import { operationalSchemas } from "./operations-validation.js";
import type { OperationalKind } from "./operations.js";
import { INDUSTRY_IDS } from "../business-industries.js";
import { validCalendarDate } from "../product-specification.js";
import { ITEM_MODELS, itemUnits, UNITS, validItemFields } from "./catalog.js";
import { quantity } from "./exact.js";
import type {
  BusinessAnswers,
  ItemDraft,
  ItemKind,
  Method,
  Unit,
  WorkspaceCommand,
} from "./model.js";
type Decode = (value: unknown) => unknown;
export function object(
  value: unknown,
  fields: Record<string, Decode>,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Solicitud inválida.");
  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).length !== Object.keys(fields).length ||
    Object.keys(raw).some((key) => !Object.hasOwn(fields, key))
  )
    throw new Error("La solicitud contiene campos incorrectos.");
  return Object.fromEntries(
    Object.entries(fields).map(([key, decode]) => [key, decode(raw[key])]),
  );
}
export function text(value: unknown, min = 0, max = 200): string {
  if (typeof value !== "string") throw new Error("Se esperaba texto.");
  const result = value.trim();
  if (result.length < min || result.length > max || /[\r\n]/.test(result))
    throw new Error(`Texto: utiliza entre ${min} y ${max} caracteres.`);
  return result;
}
export const identifier = (value: unknown): string => {
  const result = text(value, 1, 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(result))
    throw new Error("Identificador inválido.");
  return result;
};
export const optionalId = (value: unknown) =>
  value === "" ? "" : identifier(value);
export function money(value: unknown, zero = true): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (zero ? 0 : 1) ||
    value > 1e12
  )
    throw new Error("Importe fuera de límites.");
  return value;
}
export const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("Estado inválido.");
  return value;
};
export function oneOf<T extends string>(
  values: readonly T[],
): (raw: unknown) => T {
  return (raw) => {
    if (typeof raw !== "string" || !values.includes(raw as T))
      throw new Error("Opción desconocida.");
    return raw as T;
  };
}
export const industryId = oneOf(INDUSTRY_IDS);
export const unit = oneOf(Object.keys(UNITS) as Unit[]);
export const method = oneOf<Method>(["cash", "qr", "transfer"]);
export const date = (raw: unknown): string => {
  const result = text(raw, 10, 10);
  if (!validCalendarDate(result)) throw new Error("Fecha inválida.");
  return result;
};
export const optionalDate = (raw: unknown) => (raw === "" ? "" : date(raw));
export function list(decode: Decode, max = 20, min = 1): Decode {
  return (raw) => {
    if (!Array.isArray(raw) || raw.length < min || raw.length > max)
      throw new Error(`La operación admite entre ${min} y ${max} registros.`);
    return raw.map(decode);
  };
}

function dimensional(value: unknown, max: string) {
  const v = decimal(text(value, 1, 30), 6);
  if (compare(v, ZERO) <= 0 || compare(v, decimal(max)) > 0)
    throw new Error("Medida fuera de límites.");
  return exactDecimal(v);
}
const speciesFields = (raw: unknown): Record<string, Decode> =>
  raw && typeof raw === "object" && Object.hasOwn(raw, "speciesId")
    ? { speciesId: identifier, thicknessMm: (v) => dimensional(v, "10000") } : {};
export const timberSelection = (raw: unknown) =>
  object(raw, {
    ...speciesFields(raw),
    lengthMm: (v) => dimensional(v, "100000"),
    widths: list(
      (v) =>
        object(v, {
          widthMm: (v) => dimensional(v, "10000"),
          pieces: (v) => {
            if (
              typeof v !== "number" ||
              !Number.isSafeInteger(v) ||
              v < 1 ||
              v > 1000000
            )
              throw new Error("Indica de 1 a 1.000.000 de piezas enteras.");
            return v;
          },
        }),
      100,
    ),
  });
function timberField(raw: unknown, sale = false): Record<string, Decode> {
  if (!raw || typeof raw !== "object" || !Object.hasOwn(raw, "timber"))
    return {};
  return {
    timber: (v: unknown) =>
      sale
        ? object(v, {
            ...speciesFields(v),
            lengthMm: (x) => dimensional(x, "100000"),
            widths: (x) => timberSelection({ lengthMm: "1", widths: x }).widths,
            priceMinor: (x) => money(x, false),
          })
        : timberSelection(v),
  };
}

const strings = list((value) => text(value, 1, 80), 100, 0);
export const answers = (raw: unknown): BusinessAnswers =>
  object(raw, {
    weighted: boolean,
    bulk: boolean,
    timberMode: oneOf(["piece", "volume"]),
    documentFooter: (v) => text(v, 0, 300),
    address: (v) => text(v, 0, 160),
    phone: (v) => text(v, 0, 30),
  }) as unknown as BusinessAnswers;
export function itemDraft(raw: unknown): ItemDraft {
  const hasDetails =
    !!raw && typeof raw === "object" && Object.hasOwn(raw, "details");
  const item = object(raw, {
    ...(hasDetails
      ? {
          details: (v: unknown) =>
            object(v, {
              brand: (v) => text(v, 0, 80),
              location: (v) => text(v, 0, 80),
              description: (v) => text(v, 0, 200),
              equivalents: (v) => text(v, 0, 200),
              compatibility: (v) => text(v, 0, 200),
            }),
        }
      : {}),
    name: (v) => text(v, 2, 80),
    kind: oneOf(Object.keys(ITEM_MODELS) as ItemKind[]),
    fields: (v) => v,
    barcode: (v) => text(v, 0, 40).toUpperCase(),
    priceMinor: (v) => money(v, false),
    priceUnit: unit,
    minimum: (v) => quantity(v),
    serviceCostMinor: money,
  }) as unknown as ItemDraft;
  if (
    !item.fields ||
    typeof item.fields !== "object" ||
    Array.isArray(item.fields) ||
    Object.values(item.fields).some((v) => typeof v !== "string")
  )
    throw new Error("Ficha inválida.");
  item.fields = validItemFields(item.kind, item.fields);
  if (item.kind === "timber-grouped")
    item.fields.thicknessMm = exactDecimal(
      decimal(item.fields.thicknessMm!, 6),
    );
  validateItemMinimum(item.kind, item.minimum);
  if (item.kind === "timber-grouped" && item.priceUnit !== "boardFoot")
    throw new Error("La tarifa de madera agrupada se declara por pie tablar.");
  if (!itemUnits(item).units[item.priceUnit])
    throw new Error("Unidad de precio incompatible.");
  return item;
}
export function commercialQuantity(value: unknown, allowZero = true) {
  const result = quantity(value, allowZero);
  if (
    1000000n % BigInt(result.d) !== 0n ||
    BigInt(result.n) > (999999999999999n * BigInt(result.d)) / 1000000n
  )
    throw new Error("Cantidad: hasta 999.999.999 y seis decimales.");
  return result;
}
const qty: Decode = (value) => commercialQuantity(value, false);
const opening = (raw: unknown) =>
  object(raw, {
    ...timberField(raw, false),
    qty: (v) => commercialQuantity(v),
    unit,
    unitCostMinor: money,
    lot: (v) => text(v, 0, 80),
    expiresOn: optionalDate,
    serials: strings,
  });
const purchaseLine = (raw: unknown) =>
  object(raw, {
    ...timberField(raw, false),
    itemId: identifier,
    qty,
    unit,
    unitCostMinor: (v) => money(v, false),
    lot: (v) => text(v, 0, 80),
    expiresOn: optionalDate,
    serials: strings,
  });
const saleLine = (raw: unknown) =>
  object(raw, {
    ...timberField(raw, true),
    itemId: identifier,
    qty,
    unit,
    fullBoxes: boolean,
    wastePercent: (v) => {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 30)
        throw new Error("Merma: entre 0 y 30 %.");
      return v;
    },
    serials: strings,
    expectedPriceMinor: (v) => money(v, false),
  });
const returnLine = (raw: unknown) =>
  object(raw, {
    ...timberField(raw, false),
    line: (v) => {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= 20)
        throw new Error("Línea inválida.");
      return v;
    },
    qty,
    unit,
    restock: boolean,
    serials: strings,
  });
const customerName = (v: unknown) => text(v, 0, 80),
  reason = (v: unknown) => text(v, 3, 200);
const schemas: Record<
  Exclude<WorkspaceCommand["kind"], OperationalKind>,
  Record<string, Decode>
> = {
  "timber-species": {
    id: identifier, name: (v) => text(v, 2, 80), reference: (v) => text(v, 0, 40),
    prices: (v) => object(v, { superShort: (x) => money(x, false), short: (x) => money(x, false), long: (x) => money(x, false) }),
    expectedRevision: (v) => { if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new Error("Revisión inválida."); return v; }, active: boolean,
  },
  "timber-preferences": { system: oneOf(["imperial", "metric"]) },
  "confirm-type": { industryId, answers },
  preferences: {
    name: (v) => text(v, 2, 80),
    address: (v) => text(v, 0, 160),
    phone: (v) => text(v, 0, 30),
    documentFooter: (v) => text(v, 0, 300),
  },
  "create-item": { item: itemDraft, opening },
  variants: { items: list(itemDraft, 50) },
  "edit-item": {
    id: identifier,
    name: (v) => text(v, 2, 80),
    priceMinor: (v) => money(v, false),
    serviceCostMinor: money,
    minimum: (v) => quantity(v),
    active: boolean,
  },
  purchase: {
    lines: list(purchaseLine),
    method,
    date,
    reference: (v) => text(v, 0, 100),
  },
  sale: {
    lines: list(saleLine),
    method: oneOf(["cash", "qr", "transfer", "credit"]),
    date,
    customerId: optionalId,
    customerName,
    discountMinor: money,
    quoteId: optionalId,
  },
  quote: {
    lines: list(saleLine),
    customerId: optionalId,
    customerName,
    discountMinor: money,
    validUntil: date,
  },
  return: { saleId: identifier, lines: list(returnLine), reason, method },
  exchange: {
    saleId: identifier,
    returns: list(returnLine),
    lines: list(saleLine),
    reason,
    method,
    customerName,
  },
  "open-cash": { amountMinor: money },
  "close-cash": { countedMinor: money, reason: (v) => text(v, 0, 200) },
  "cash-adjust": {
    direction: oneOf(["in", "out"]),
    amountMinor: (v) => money(v, false),
    reason,
  },
  expense: {
    amountMinor: (v) => money(v, false),
    method,
    date,
    description: reason,
    category: (v) => text(v, 1, 60),
  },
  "cancel-expense": { id: identifier, reason },
  collect: { id: identifier, method },
  customer: {
    id: identifier,
    name: (v) => text(v, 2, 80),
    phone: (v) => text(v, 0, 30),
    notes: (v) => text(v, 0, 200),
    active: boolean,
  },
  debt: {
    customerId: optionalId,
    customerName,
    amountMinor: (v) => money(v, false),
    description: reason,
    date,
  },
  "cancel-debt": { id: identifier, reason },
  unpack: { sourceId: identifier, targetId: identifier, bags: qty },
  warranty: {
    saleId: identifier,
    serialId: identifier,
    description: reason,
    status: oneOf(["received", "diagnosis", "resolved"]),
    resolution: (v) => text(v, 0, 200),
  },
  "release-serial": { serialId: identifier, reason },
  "stock-adjust": {
    itemId: identifier,
    direction: oneOf(["in", "out"]),
    qty,
    unit,
    unitCostMinor: money,
    reason,
    lot: (v) => text(v, 0, 80),
    expiresOn: optionalDate,
    serials: strings,
  },
  "convert-legacy": {
    productId: identifier,
    item: itemDraft,
    qty,
    unit,
    lot: (v) => text(v, 0, 80),
    expiresOn: optionalDate,
    serials: strings,
    expectedStock: (v) => {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 1e6)
        throw new Error("Existencia anterior inválida.");
      return v;
    },
    expectedValueMinor: money,
  },
  "legacy-value": { productId: identifier, unitCostMinor: money },
  "legacy-commerce": { command: (v) => v },
  "recover-legacy": {
    source: oneOf(["inventory", "commerce"]),
    request: (v) => v,
  },
  "report-document": { from: date, to: date, inventory: boolean },
};
export function validateWorkspaceCommand(raw: unknown): WorkspaceCommand {
  const allSchemas: Record<string, Record<string, Decode>> = {
    ...schemas,
    ...operationalSchemas(schemas.sale),
  };
  const envelope = object(raw, {
    apiVersion: (v) => {
      if (v !== 2) throw new Error("Actualiza la aplicación.");
      return 2;
    },
    businessId: identifier,
    operationId: (v) => {
      const id = identifier(v);
      if (id.length > 80)
        throw new Error("Identificador de operación demasiado largo.");
      return id;
    },
    kind: oneOf(Object.keys(allSchemas) as WorkspaceCommand["kind"][]),
    input: (v) => v,
  });
  return {
    ...envelope,
    input: object(envelope.input, {
      ...(envelope.kind === "timber-species" && envelope.input && typeof envelope.input === "object" && (Object.hasOwn(envelope.input, "species") || Object.hasOwn(envelope.input, "code"))
        ? { species: (v: unknown) => text(v, 2, 80), code: (v: unknown) => { const code = text(v, 0, 40).toUpperCase(); if (code && !/^[A-Z0-9][A-Z0-9._-]*$/.test(code)) throw new Error("Código: usa letras, números, guiones o puntos."); return code; } } : {}),
      ...allSchemas[envelope.kind as WorkspaceCommand["kind"]]!,
      ...(envelope.kind === "stock-adjust" ? timberField(envelope.input) : {}),
    }),
  } as WorkspaceCommand;
}

export function validateItemMinimum(
  kind: ItemKind,
  value: { n: string; d: string },
) {
  if (["timber-volume", "timber-grouped"].includes(kind)) {
    if (BigInt(value.n) > 999999999000000000n * BigInt(value.d))
      throw new Error("El mínimo supera el límite permitido.");
  } else commercialQuantity(value);
}
