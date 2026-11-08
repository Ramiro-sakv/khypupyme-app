import { displayQuantity } from "./presentation.js";
import {
  add,
  decimal,
  div,
  fraction,
  mul,
  showQuantity,
  ZERO,
} from "./exact.js";
import type { Item } from "./model.js";
import type { Quantity } from "./exact.js";
export type TimberSystem = "imperial" | "metric";
export const INCH_MM = fraction(127n, 5n),
  FOOT_MM = fraction(1524n, 5n),
  BOARD_FOOT_MM3 = fraction(294967152n, 125n);
export function timberMeasure(raw: string): Quantity {
  const text = raw.trim().replace(",", ".");
  const match = /^(?:(\d{1,6})\s+)?(\d{1,6})\/(2|4|8|16)$/.exec(text);
  const result = match
    ? add(
        decimal(match[1] ?? "0", 0),
        fraction(BigInt(match[2]!), BigInt(match[3]!)),
      )
    : decimal(text, 4);
  if (result.n === "0") throw new Error("La medida debe ser mayor a cero.");
  return result;
}
export function exactDecimal(value: Quantity, places = 6) {
  const scale = 10n ** BigInt(places),
    scaled = BigInt(value.n) * scale;
  if (scaled % BigInt(value.d) !== 0n)
    throw new Error("La medida excede la precisión admitida.");
  const n = scaled / BigInt(value.d),
    tail = String(n % scale)
      .padStart(places, "0")
      .replace(/0+$/, "");
  return String(n / scale) + (tail ? "." + tail : "");
}
export const dimensionToMm = (raw: string, key: string, system: TimberSystem) =>
  exactDecimal(
    system === "metric"
      ? decimal(raw, 6)
      : mul(timberMeasure(raw), key === "lengthMm" ? FOOT_MM : INCH_MM),
  );
export function dimensionLabel(key: string, system: TimberSystem) {
  const label =
    (
      { lengthMm: "Largo", widthMm: "Ancho", thicknessMm: "Espesor" } as Record<
        string,
        string
      >
    )[key] ?? key;
  return (
    label +
    (system === "metric"
      ? " (mm)"
      : key === "lengthMm"
        ? " (pies)"
        : " (pulgadas)")
  );
}
export function dimensionDisplayFromMm(
  raw: string,
  key: string,
  system: TimberSystem,
) {
  const value = decimal(raw, 6),
    converted =
      system === "metric"
        ? value
        : div(value, key === "lengthMm" ? FOOT_MM : INCH_MM),
    text = displayQuantity(converted),
    rounded = decimal(text, 2);
  return (
    (BigInt(rounded.n) * BigInt(converted.d) ===
    BigInt(converted.n) * BigInt(rounded.d)
      ? ""
      : "≈") + text
  );
}
export function timberDimensions(
  fields: Record<string, string>,
  system: TimberSystem = "imperial",
) {
  if (!fields.lengthMm || !fields.widthMm || !fields.thicknessMm) return "";
  const show = (key: string) =>
    dimensionDisplayFromMm(fields[key]!, key, system) +
    (system === "metric" ? " mm" : key === "lengthMm" ? "′" : "″");
  return (
    show("thicknessMm") + " × " + show("widthMm") + " × " + show("lengthMm")
  );
}
export function timberVolume(fields: Record<string, string>) {
  return fields.lengthMm && fields.widthMm && fields.thicknessMm
    ? mul(
        mul(decimal(fields.lengthMm, 6), decimal(fields.widthMm, 6)),
        decimal(fields.thicknessMm, 6),
      )
    : ZERO;
}

export function dimensionInputFromMm(
  raw: string,
  key: string,
  system: TimberSystem,
) {
  return system === "metric"
    ? raw
    : showQuantity(
        div(decimal(raw, 6), key === "lengthMm" ? FOOT_MM : INCH_MM),
        4,
      ).replace(",", ".");
}
export function timberStockText(
  item: Pick<Item, "kind" | "fields" | "balance" | "pieces">,
  system: TimberSystem = "imperial",
): string | null {
  if (item.kind === "timber-grouped")
    return (
      (item.pieces ?? 0) +
      " piezas · " +
      timberStockText({ ...item, kind: "timber-volume" }, system)
    );
  if (item.kind === "timber-volume")
    return (
      displayQuantity(
        div(
          item.balance,
          system === "imperial" ? BOARD_FOOT_MM3 : fraction(1000000000n),
        ),
      ) + (system === "imperial" ? " pies tablares" : " m³")
    );
  if (item.kind === "timber-piece")
    return (
      displayQuantity(item.balance) +
      " piezas · " +
      displayQuantity(
        div(
          mul(item.balance, timberVolume(item.fields)),
          system === "imperial" ? BOARD_FOOT_MM3 : fraction(1000000000n),
        ),
      ) +
      (system === "imperial" ? " pies tablares" : " m³")
    );
  return null;
}
export function minimumText(
  item: Pick<Item, "kind" | "minimum">,
  system: TimberSystem = "imperial",
) {
  return showQuantity(
    ["timber-volume", "timber-grouped"].includes(item.kind)
      ? div(
          item.minimum,
          system === "imperial" ? BOARD_FOOT_MM3 : fraction(1000000000n),
        )
      : item.minimum,
  );
}
export function minimumInput(
  item: Pick<Item, "kind" | "minimum">,
  raw: string,
  system: TimberSystem = "imperial",
) {
  if (raw.trim().replace(".", ",") === minimumText(item, system))
    return item.minimum;
  const value = decimal(raw);
  return ["timber-volume", "timber-grouped"].includes(item.kind)
    ? mul(value, system === "imperial" ? BOARD_FOOT_MM3 : fraction(1000000000n))
    : value;
}
