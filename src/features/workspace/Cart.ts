import { ceil, div, fraction, mul } from "../../../shared/workspace/exact";
import type {
  Item,
  ReceiptLineInput,
  SaleLineInputV2,
  Unit,
} from "../../../shared/workspace/model";
import { cents, q } from "./format";

export interface CartLine {
  item: Item;
  qty: string;
  unit: Unit;
  cost: string;
  lot: string;
  expiresOn: string;
  serials: string[];
  fullBoxes: boolean;
  wastePercent: number;
}
export function delivered(line: CartLine) {
  let requested = mul(q(line.qty), line.item.units[line.unit]!);
  if (line.item.kind === "ceramic" && line.unit === "m2")
    requested = mul(requested, fraction(BigInt(100 + line.wastePercent), 100n));
  if (line.item.kind === "timber-piece" || line.item.kind === "ceramic")
    requested = ceil(requested);
  if (line.item.kind === "ceramic" && line.fullBoxes)
    requested = mul(
      ceil(div(requested, line.item.units.box!)),
      line.item.units.box!,
    );
  return requested;
}
export function saleInputs(lines: CartLine[]): SaleLineInputV2[] {
  return lines.map((l) => ({
    itemId: l.item.id,
    qty: q(l.qty),
    unit: l.unit,
    fullBoxes: l.fullBoxes,
    wastePercent: l.wastePercent,
    serials: l.serials,
    expectedPriceMinor: l.item.priceMinor,
  }));
}
export function receiptInputs(lines: CartLine[]): ReceiptLineInput[] {
  return lines.map((l) => ({
    itemId: l.item.id,
    qty: q(l.qty),
    unit: l.unit,
    unitCostMinor: cents(l.cost),
    lot: l.lot,
    expiresOn: l.expiresOn,
    serials: l.serials,
  }));
}
