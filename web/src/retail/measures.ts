import type { components } from "../api/schema";
import type { EntryDocument, Product } from "../commerce/models";
import { dateLabel } from "../commerce/models";

type Schema = components["schemas"];
export type RetailProfile = Schema["RetailProfile"];
export type Measure = Schema["RetailInput"];
export type Serial = Schema["SerialInfo"];
export type Lot = Schema["LotInfo"];
export type StoreAttention = Schema["StoreAttention"];

export const unitLabels: Readonly<Record<string, string>> = {
  piece: "unidad", box: "caja", g: "g", kg: "kg", lb: "lb", ml: "mL", l: "L",
};
const factors: Readonly<Record<string, bigint>> = {
  piece: 100_000n, g: 100_000n, kg: 100_000_000n, lb: 45_359_237n, ml: 100_000n, l: 100_000_000n,
};
const quantityFormat = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 8 });
export const quantityLabel = (quantity: number) => quantityFormat.format(quantity);
export const baseUnit = (unit: string) => unit === "piece" ? "unidad" : ["ml", "l"].includes(unit) ? "mL" : "g";
export const fromBase = (quantity: number, unit: string) => quantity / (Number(factors[unit]) / 100_000);

export function retailUnits(profile: RetailProfile, buying: boolean, mixed?: boolean) {
  if (profile.unit === "piece") return (buying || mixed) && profile.boxSize > 1 ? ["box", "piece"] : ["piece"];
  return baseUnit(profile.unit) === "g" ? ["g", "kg", "lb"] : ["ml", "l"];
}

export function measurePreview(quantity: string, unit: string, profile: RetailProfile, buying: boolean, minor: number | null,
  loose?: number | null, mixed?: boolean) {
  const match = /^(\d{1,7})(?:[.,](\d{1,3}))?$/.exec(quantity.trim());
  if (!match || !retailUnits(profile, buying, mixed).includes(unit) ||
    loose != null && (!mixed || unit !== "box" || !Number.isInteger(loose) || loose < 0 || loose > 1_000_000)) return null;
  const milli = BigInt(match[1]) * 1000n + BigInt((match[2] ?? "").padEnd(3, "0"));
  if (milli === 0n && !loose || milli > 1_000_000_000n || profile.unit === "piece" && milli % 1000n !== 0n) return null;
  const factor = unit === "box" ? BigInt(profile.boxSize) * factors.piece : factors[unit];
  const scaled = milli * factor + BigInt(loose ?? 0) * 100_000_000n;
  if (scaled > (profile.unit === "piece" ? 100_000_000_000_000n : 100_000_000_000_000_000n)) return null;
  const denominator = 1000n * (buying ? factor : factors[profile.unit]);
  const numerator = scaled * BigInt(minor ?? 0);
  return { base: Number(scaled) / 100_000_000, subtotal: minor === null ? null : Number((2n * numerator + denominator) / (2n * denominator)) };
}

export function productAvailability(product: Product) {
  if (!product.retail) return product.stock + (product.equipment ? " equipos" : " piezas");
  const count = fromBase(product.sellableStock ?? 0, product.retail.unit);
  return quantityLabel(count) + " " + (product.retail.unit === "piece" && count !== 1 ? "unidades" : unitLabels[product.retail.unit]);
}

export const seriesFromText = (text: string) => text.split(/[\r\n;,]+/).map((item) => item.trim()).filter(Boolean);

export function describeLine(line: EntryDocument["lines"][number]) {
  const details = line.details;
  if (!details) return "";
  const variant = details.apparel;
  const conversion = details.measure && details.baseQuantity != null && unitLabels[details.measure.unit] !== baseUnit(details.measure.unit) ?
    "Equivale a " + quantityLabel(details.baseQuantity) + " " + baseUnit(details.measure.unit) : "";
  const lot = details.lots?.map((item) => item.lot + (details.lots!.length > 1 && details.measure ?
    " · " + quantityLabel(item.quantity) + " " + baseUnit(details.measure.unit) : "") +
    (item.expiresOn ? " (vence " + dateLabel(item.expiresOn) + ")" : "")).join(", ");
  return [details.direction === "returned" ? "Devuelto" : details.direction === "replacement" ? "Reemplazo" : "",
    variant && [variant.model, "Talla " + variant.size, variant.color].join(" · "),
    details.serial && "Serie " + details.serial,
    details.warrantyUntil && "Garantía declarada hasta " + dateLabel(details.warrantyUntil),
    conversion, lot && "Lote " + lot].filter(Boolean).join(" · ");
}

export function lineQuantity(line: EntryDocument["lines"][number]) {
  const measure = line.details?.measure;
  if (!measure) return String(line.quantity);
  if (measure.unit === "box") return measure.quantity + (measure.quantity === "1" ? " caja" : " cajas") +
    (measure.loose ? " + " + measure.loose + (measure.loose === 1 ? " suelta" : " sueltas") : "");
  return measure.quantity + " " + unitLabels[measure.unit];
}
export const lineRate = (line: EntryDocument["lines"][number]) => line.details?.rateUnit ? " / " + unitLabels[line.details.rateUnit] : "";

export function remainingQuantity(line: EntryDocument["lines"][number]) {
  const details = line.details;
  if (details?.direction === "returned") return 0;
  const measured = details?.measure;
  if (measured && details?.baseQuantity != null) {
    const factor = Number(factors[returnUnit(measured)]) / 100_000;
    return Math.round((details.baseQuantity - line.returnedBaseQuantity) / factor * 1000) / 1000;
  }
  return line.quantity - line.returnedQuantity;
}

export const returnUnit = (measure: Measure) => measure.unit === "box" ? "piece" : measure.unit;
