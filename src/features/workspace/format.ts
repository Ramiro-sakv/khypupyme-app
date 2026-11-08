import {
  timberDimensions,
  dimensionDisplayFromMm as dimensionInputFromMm,
} from "../../../shared/workspace/timber-measures";
import type { TimberSystem } from "../../../shared/workspace/timber-measures";
import { amount, decimal, fraction } from "../../../shared/workspace/exact";
import { ITEM_MODELS } from "../../../shared/workspace/catalog";
import type { ItemDraft } from "../../../shared/workspace/model";
import type { Method } from "../../../shared/workspace/model";
export const bob = (minor: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(
    minor / 100,
  );
export const cents = (value: FormDataEntryValue | null | string) => {
  const text = String(value ?? "0")
    .trim()
    .replace(",", ".");
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Importe BOB: hasta dos decimales, sin separador de miles.",
    );
  const [units = "0", part = ""] = text.split(".");
  return amount(
    1,
    fraction(BigInt(units) * 100n + BigInt(part.padEnd(2, "0"))),
  );
};
export const q = (value: FormDataEntryValue | null | string) =>
  decimal(String(value ?? "0"));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const serials = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
export const method = (data: FormData) => String(data.get("method")) as Method;

export function averageCost(
  valueMinor: number,
  balance: { n: string; d: string },
  unit: { n: string; d: string },
) {
  const n = BigInt(valueMinor) * BigInt(unit.n) * BigInt(balance.d),
    d = BigInt(unit.d) * BigInt(balance.n),
    minor = (2n * n + d) / (2n * d);
  return (
    "Bs " + String(minor / 100n) + "," + String(minor % 100n).padStart(2, "0")
  );
}

export function localDate(value: string, time = false) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(date);
}
export function statusLabel(value: string) {
  return (
    (
      {
        active: "Activo",
        returned: "Devuelta",
        pending: "Pendiente",
        paid: "Pagado",
        cancelled: "Anulado",
        open: "Abierta",
        closed: "Cerrada",
        available: "Disponible",
        sold: "Vendido",
        inspection: "En inspección",
        "written-off": "Baja",
        received: "Recibido",
        diagnosis: "En diagnóstico",
        resolved: "Resuelto",
        cash: "Efectivo",
        qr: "QR",
        transfer: "Transferencia",
        credit: "Fiado",
        sale: "Venta",
        purchase: "Compra",
        expense: "Gasto",
        collection: "Cobro",
        return: "Devolución",
        exchange: "Cambio",
        opening: "Stock inicial",
        entry: "Entrada",
        loss: "Salida con pérdida",
        release: "Liberación",
        "return-loss": "Devolución sin reingreso",
        "expense-reversal": "Anulación de gasto",
        aporte: "Aporte",
        retiro: "Retiro",
        payment: "Pago",
        transferStock: "Transformación",
      } as Record<string, string>
    )[value] ?? "Registro"
  );
}

export function itemDetails(
  item: Pick<ItemDraft, "kind" | "fields" | "details">,
  system: TimberSystem = "imperial",
) {
  if (item.kind === "timber-grouped")
    return (
      item.fields.species +
      " · " +
      dimensionInputFromMm(item.fields.thicknessMm!, "thicknessMm", system) +
      (system === "imperial" ? "″" : " mm") +
      " · medidas agrupadas"
    );
  return [
    ...(item.kind === "timber-piece"
      ? [item.fields.species, timberDimensions(item.fields, system)]
      : [
          ITEM_MODELS[item.kind].fields
            .filter((field) => item.fields[field.key])
            .map(
              (field) =>
                field.label
                  .replace(": si o no", "")
                  .replace(": pieza o par", "") +
                ": " +
                item.fields[field.key],
            )
            .join(" · "),
        ]),
    ...Object.values(item.details ?? {}).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" · ");
}
