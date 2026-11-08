import { AppError } from "../app-errors.js";
import { decimal, div, ZERO } from "./exact.js";
import { exactDecimal } from "./timber-measures.js";
import { itemUnits } from "./catalog.js";
import type { Item, TimberCategory, TimberSpecies } from "./model.js";

export const TIMBER_CATEGORIES: Record<TimberCategory, string> = {
  superShort: "Supercorta · 1–2 pies", short: "Corta · 3–6 pies", long: "Larga · 7–20 pies",
};
export function timberCategory(lengthMm: string): TimberCategory {
  const feet = div(decimal(lengthMm, 6), decimal("304.8"));
  if (feet.d !== "1" || BigInt(feet.n) < 1n || BigInt(feet.n) > 20n)
    throw new AppError("Indica un largo entero de 1 a 20 pies. En métrico debe equivaler exactamente a esos pies.", 400, "TIMBER_LENGTH", "timber-length");
  return BigInt(feet.n) <= 2n ? "superShort" : BigInt(feet.n) <= 6n ? "short" : "long";
}
export function timberThickness(value: string) {
  const q = decimal(value, 6);
  if (BigInt(q.n) <= 0n || BigInt(q.n) > 10000n * BigInt(q.d))
    throw new AppError("Indica un espesor positivo dentro del límite admitido.", 400, "TIMBER_THICKNESS", "timber-thickness");
  return exactDecimal(q);
}
/** Proyección de catálogo: no representa existencias ni crea una variante. */
export function timberSpeciesItem(species: TimberSpecies, thicknessMm = ""): Item {
  const draft = { name: species.name, kind: "timber-grouped" as const, fields: { species: species.name, thicknessMm }, barcode: species.reference, priceMinor: species.prices.short, priceUnit: "boardFoot" as const, minimum: ZERO, serviceCostMinor: 0 };
  return { ...draft, ...itemUnits(draft), id: species.id, active: species.active, pieces: species.pieces, balance: species.balance, valueMinor: species.valueMinor, createdAt: species.createdAt, updatedAt: species.updatedAt, timberSpecies: species };
}
export function timberCatalogPrice(item: Item, lengthMm?: string) {
  // Los borradores incompletos se restauran; requireTimber vuelve a validar antes de enviar.
  if (item.timberSpecies && lengthMm) {
    try { return item.timberSpecies.prices[timberCategory(lengthMm)]; } catch { /* Aún no hay categoría válida. */ }
  }
  return item.priceMinor;
}
