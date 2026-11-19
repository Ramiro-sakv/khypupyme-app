import type { components } from "../api/schema";

type Schema = components["schemas"];
export type Dimensions = Schema["TimberDimensions"];
export type Rates = Schema["TimberPrices"];
export type StockRow = Schema["TimberStockInfo"];
export type TimberUnits = "imperial" | "metric";
export type Capture = {
  units: TimberUnits; length: string; thickness: string; widths: string;
  selection?: { timber: Dimensions; quantity: string };
};

const mm = 1_000_000n;
const inch = 25_400_000n;
const foot = 304_800_000n;
const boardFoot = 2_359_737_216n * 10n ** 15n;
const cubicMetre = 10n ** 27n;
const quantityFormat = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });
const dimensionFormat = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 6, useGrouping: false });

export const unitsOf = (value?: string | null): TimberUnits => value === "metric" ? "metric" : "imperial";
export const volumeUnit = (units: TimberUnits) => units === "metric" ? "m³" : "pies tablares";
export const measureKey = (d: Dimensions) => [d.lengthMicros, d.thicknessMicros, d.widthMicros].join(":");
export const lengthUnit = (units: TimberUnits) => units === "metric" ? "mm" : "pies";
export const faceUnit = (units: TimberUnits) => units === "metric" ? "mm" : "pulgadas";

function fraction(raw: string): [bigint, bigint] {
  const value = raw.trim();
  const decimal = /^(\d{1,5})(?:[.,](\d{1,6}))?$/.exec(value) ?? /^()(?:[.,](\d{1,6}))$/.exec(value);
  if (decimal) {
    const decimals = decimal[2] ?? "";
    return [BigInt((decimal[1] || "0") + decimals), 10n ** BigInt(decimals.length)];
  }
  const mixed = /^(?:(\d{1,5})\s+)?(\d{1,5})\s*\/\s*(2|4|8|16)$/.exec(value);
  if (!mixed) throw new Error("Usa un número o una fracción como 1 1/2.");
  const denominator = BigInt(mixed[3]);
  return [BigInt(mixed[1] ?? 0) * denominator + BigInt(mixed[2]), denominator];
}

export function dimension(raw: string, units: TimberUnits, axis: "length" | "face" | "width") {
  const [numerator, denominator] = fraction(raw);
  const commercial = units === "imperial" && axis === "width";
  const factor = units === "metric" ? mm : axis === "length" ? foot : inch;
  const scaled = commercial ? (numerator / denominator) * factor : numerator * factor / denominator;
  if (scaled <= 0n || scaled > 10_000n * mm)
    throw new Error(commercial ? "El ancho comercial debe ser de al menos una pulgada y hasta 10.000 mm." : "La medida debe ser mayor que cero y de hasta 10.000 mm.");
  if (!commercial && numerator * factor % denominator !== 0n)
    throw new Error("Reduce los decimales para que la medida se pueda guardar exactamente.");
  if (axis === "length" && (scaled % foot !== 0n || scaled / foot > 20n))
    throw new Error("Indica un largo equivalente a 1–20 pies enteros.");
  return { value: Number(scaled), normalized: commercial && numerator % denominator !== 0n };
}

function pieces(value: string) {
  if (!/^\d{1,7}$/.test(value) || Number(value) < 1 || Number(value) > 1_000_000)
    throw new Error("Las piezas deben ser un número entero entre 1 y 1.000.000.");
  return Number(value);
}

export function captureTimber(capture: Capture) {
  const rows: { timber: Dimensions; quantity: number }[] = [];
  const notices = new Set<string>();
  try {
    if (capture.selection) {
      rows.push({ timber: capture.selection.timber, quantity: pieces(capture.selection.quantity) });
    } else {
      if (!capture.length.trim() || !capture.thickness.trim()) throw new Error("Indica el largo y el espesor.");
      const lengthMicros = dimension(capture.length, capture.units, "length").value;
      const thicknessMicros = dimension(capture.thickness, capture.units, "face").value;
      if (!capture.widths.trim()) throw new Error("Indica los anchos de las piezas.");
      const widths = new Map<number, number>();
      for (const text of capture.widths.trim().split(/[,;\n]/)) {
        const parts = text.trim().split(/[x×]/i);
        if (parts.length > 2 || parts.some((part) => !part.trim()))
          throw new Error("Completa cada ancho o escribe la cantidad y el ancho, como 5x10.");
        const quantity = parts.length === 2 ? pieces(parts[0].trim()) : 1;
        const width = dimension(parts.at(-1)!, capture.units, "width");
        if (width.normalized) notices.add("Se utilizará ancho " + width.value / Number(inch) + "″.");
        const accumulated = (widths.get(width.value) ?? 0) + quantity;
        if (accumulated > 1_000_000 || widths.size >= 100 && !widths.has(width.value))
          throw new Error("Divide el registro. Se admiten hasta 100 medidas y 1.000.000 de piezas por medida.");
        widths.set(width.value, accumulated);
      }
      for (const [widthMicros, quantity] of widths) rows.push({ timber: { lengthMicros, thicknessMicros, widthMicros }, quantity });
    }
    return { rows, notices: [...notices], error: "" };
  } catch (error) {
    return { rows: [], notices: [], error: error instanceof Error ? error.message : "Revisa las medidas." };
  }
}

export function timberRate(rates: Rates, dimensions: Dimensions) {
  const feet = dimensions.lengthMicros / Number(foot);
  return feet <= 2 ? rates.superShortMinor : feet <= 6 ? rates.shortMinor : rates.longMinor;
}

export function exactVolume(d: Dimensions, quantity: number) {
  return BigInt(d.lengthMicros) * BigInt(d.thicknessMicros) * BigInt(d.widthMicros) * BigInt(quantity);
}

const round = (numerator: bigint, denominator: bigint) => (2n * numerator + denominator) / (2n * denominator);

export function timberAmount(volume: bigint, minor: number) {
  return Number(round(volume * BigInt(minor), boardFoot));
}

export function timberVolume(rows: { timber: Dimensions; quantity: number }[], units: TimberUnits) {
  const total = rows.reduce((sum, row) => sum + exactVolume(row.timber, row.quantity), 0n);
  return quantityFormat.format(Number(round(total * 100n, units === "metric" ? cubicMetre : boardFoot)) / 100);
}

export function displayMeasure(value: number, units: TimberUnits, axis: "length" | "face") {
  return dimensionFormat.format(value / Number(units === "metric" ? mm : axis === "length" ? foot : inch));
}

export function timberLabel(d: Dimensions, units: TimberUnits) {
  const mark = units === "metric" ? " mm" : "″";
  return displayMeasure(d.thicknessMicros, units, "face") + mark + " × " +
    displayMeasure(d.widthMicros, units, "face") + mark + " × " +
    displayMeasure(d.lengthMicros, units, "length") + (units === "metric" ? " mm" : "′");
}

export function documentTimber(record: Schema["EntryDocument"], line: Schema["DocumentLine"]) {
  if (!line.timber) return "";
  const units = unitsOf(record.timberUnits);
  return [line.species, timberLabel(line.timber, units),
    timberVolume([{ timber: line.timber, quantity: line.quantity }], units) + " " + volumeUnit(units)].filter(Boolean).join(" · ");
}

export function documentUnit(record: Schema["EntryDocument"], line: Schema["DocumentLine"]) {
  if (!line.timber) return "";
  if (record.kind === "purchase" || record.kind === "stock-in") return line.details?.timberCostUnit === "board-foot" ? " / pie tablar" : " / pieza";
  return ["sale", "quote", "return"].includes(record.kind) ? " / pie tablar" : "";
}
