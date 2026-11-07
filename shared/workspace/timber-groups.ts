import {
  add,
  decimal,
  div,
  fraction,
  mul,
  showQuantity,
  ZERO,
} from "./exact.js";
import { BOARD_FOOT_MM3, timberDimensions } from "./timber-measures.js";
import type { TimberSelection } from "./model.js";
import type { Quantity } from "./exact.js";

/** A piece has its own dimensions: there is never a fixed piece/volume conversion. */
export function timberTotals(thicknessMm: string, selection: TimberSelection) {
  const thickness = decimal(thicknessMm, 6),
    length = decimal(selection.lengthMm, 6);
  let pieces = 0,
    volume = ZERO;
  for (const row of selection.widths) {
    pieces += row.pieces;
    volume = add(
      volume,
      mul(
        mul(mul(thickness, length), decimal(row.widthMm, 6)),
        fraction(BigInt(row.pieces)),
      ),
    );
  }
  return { pieces, volume, boardFeet: div(volume, BOARD_FOOT_MM3) };
}
export function timberSelectionText(
  thicknessMm: string,
  selection: TimberSelection,
  system: "imperial" | "metric" = "imperial",
) {
  return selection.widths
    .map(
      (row) =>
        row.pieces +
        " × " +
        timberDimensions(
          { thicknessMm, lengthMm: selection.lengthMm, widthMm: row.widthMm },
          system,
        ),
    )
    .join("; ");
}
export const timberGroupKey = (
  itemId: string,
  lengthMm: string,
  widthMm: string,
) =>
  [itemId, decimal(lengthMm, 6), decimal(widthMm, 6)]
    .map((v) => (typeof v === "string" ? v : v.n + "/" + v.d))
    .join("|");
export function timberVolumeLabel(volume: Quantity) {
  return showQuantity(div(volume, BOARD_FOOT_MM3)) + " pies tablares";
}
