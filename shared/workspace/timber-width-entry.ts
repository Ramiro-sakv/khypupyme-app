import { AppError } from "../app-errors.js";
import { decimal, div, fraction, mul } from "./exact.js";
import {
  dimensionToMm,
  exactDecimal,
  INCH_MM,
  timberMeasure,
} from "./timber-measures.js";
import type { TimberSystem } from "./timber-measures.js";
import type { TimberSelection } from "./model.js";

export interface TimberWidthEntry {
  version: 2;
  system: TimberSystem;
  text: string;
  source: "text" | "selection";
}
export function parseTimberWidths(text: string, system: TimberSystem) {
  const widths: TimberSelection["widths"] = [],
    notices = new Set<string>();
  if (!text.trim()) return { widths, notices: [] as string[] };
  if (text.length > 20000)
    throw new AppError(
      "La lista de anchos es demasiado extensa. Divide la operación.",
      400,
      "WIDTH_LIMIT",
      "timber-widths",
    );
  let total = 0;
  for (const raw of text.trim().split(/[,;\n]/)) {
    const token = raw.trim(),
      parts = token.split(/\s*[xX×]\s*/);
    if (!token || parts.length > 2 || parts.some((p) => !p.trim()))
      throw new AppError(
        "Completa cada ancho y la cantidad después del multiplicador. Sugerencia: 5x10, 4x7.",
        400,
        "WIDTH_INCOMPLETE",
        "timber-widths",
      );
    const countText = parts.length === 2 ? parts[0]! : "1",
      widthText = parts.at(-1)!.trim();
    if (
      !/^\d{1,7}$/.test(countText) ||
      Number(countText) < 1 ||
      Number(countText) > 1000000
    )
      throw new AppError(
        "La cantidad del multiplicador debe ser un entero entre 1 y 1.000.000.",
        400,
        "WIDTH_COUNT",
        "timber-widths",
      );
    let widthMm: string;
    try {
      if (system === "imperial") {
        const oldFraction = /^(\d{1,14})\/([1-9]\d{0,13})$/.exec(widthText);
        const entered = oldFraction
            ? fraction(BigInt(oldFraction[1]!), BigInt(oldFraction[2]!))
            : timberMeasure(widthText),
          inches = BigInt(entered.n) / BigInt(entered.d);
        if (inches < 1n)
          throw new Error(
            "El ancho comercial debe ser de al menos una pulgada.",
          );
        widthMm = exactDecimal(mul(fraction(inches), INCH_MM));
        if (BigInt(entered.n) % BigInt(entered.d) !== 0n)
          notices.add("Se utilizará ancho " + inches + "″.");
      } else {
        if (decimal(widthText, 6).n === "0")
          throw new Error("El ancho debe ser mayor a cero.");
        widthMm = dimensionToMm(widthText, "widthMm", system);
      }
      if (Number(widthMm) > 10000)
        throw new Error("El ancho supera el límite admitido.");
    } catch (cause) {
      throw new AppError(
        "Revisa el ancho «" +
          widthText +
          "»: " +
          (cause instanceof Error ? cause.message : "medida inválida."),
        400,
        "WIDTH_INVALID",
        "timber-widths",
      );
    }
    const pieces = Number(countText);
    total += pieces;
    if (total > 1000000)
      throw new AppError(
        "La lista supera 1.000.000 de piezas. Divide la operación.",
        400,
        "WIDTH_LIMIT",
        "timber-widths",
      );
    const old = widths.find((row) => row.widthMm === widthMm);
    if (old) old.pieces += pieces;
    else widths.push({ widthMm, pieces });
    if (widths.length > 100)
      throw new AppError(
        "Máximo 100 medidas distintas. Divide la operación.",
        400,
        "WIDTH_LIMIT",
        "timber-widths",
      );
  }
  return { widths, notices: [...notices] };
}
export function widthSelectionText(
  widths: TimberSelection["widths"],
  system: TimberSystem,
) {
  return widths
    .map((row) => {
      let width = row.widthMm;
      if (system === "imperial") {
        const inches = div(decimal(row.widthMm, 6), INCH_MM);
        // Keep old dimensions exactly, including recurring inch conversions.
        width = inches.d === "1" ? inches.n : inches.n + "/" + inches.d;
      }
      return (row.pieces === 1 ? "" : row.pieces + "x") + width;
    })
    .join(", ");
}
