import { timberCategory } from "../../../shared/workspace/timber-species";
import type { TimberWidthEntry } from "../../../shared/workspace/timber-width-entry";
import { requireTimber } from "./TimberWidthEntry";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import type { TimberSaleSelection } from "../../../shared/workspace/model";
import { ceil, div, fraction, mul } from "../../../shared/workspace/exact";
import type {
  Item,
  ReceiptLineInput,
  SaleLineInputV2,
  Unit,
} from "../../../shared/workspace/model";
import { cents, q } from "./format";

export interface CartLine {
  widthsEntry?: TimberWidthEntry | undefined;
  id?: string | undefined;
  timber?: TimberSaleSelection | undefined;
  lengthInput?: string | undefined;
  widthInput?: string | undefined;
  priceInput?: string | undefined;
  thicknessInput?: string | undefined;
  priceManual?: boolean | undefined;
  timberError?: string;
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
  if (line.item.kind === "timber-grouped") {
    return timberTotals(line.item.fields.thicknessMm!, requireTimber(line))
      .volume;
  }
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
  return lines.map((l) => {
    const timber =
      l.item.kind === "timber-grouped" ? requireTimber(l) : undefined;
    return {
      ...(timber ? { timber } : {}),
      itemId: l.item.id,
      qty: timber
        ? q(String(timberTotals(l.item.fields.thicknessMm!, timber).pieces))
        : q(l.qty),
      unit: l.unit,
      fullBoxes: l.fullBoxes,
      wastePercent: l.wastePercent,
      serials: l.serials,
      expectedPriceMinor: l.item.timberSpecies && timber ? l.item.timberSpecies.prices[timberCategory(timber.lengthMm)] : l.item.priceMinor,
    };
  });
}
export function receiptInputs(lines: CartLine[]): ReceiptLineInput[] {
  return lines.map((l) => {
    const timber =
      l.item.kind === "timber-grouped" ? requireTimber(l) : undefined;
    return {
      ...(timber
        ? { timber: { ...(timber.speciesId ? { speciesId: timber.speciesId, thicknessMm: timber.thicknessMm } : {}), lengthMm: timber.lengthMm, widths: timber.widths } }
        : {}),
      itemId: l.item.id,
      qty: timber
        ? q(String(timberTotals(l.item.fields.thicknessMm!, timber).pieces))
        : q(l.qty),
      unit: l.unit,
      unitCostMinor: cents(l.cost),
      lot: l.lot,
      expiresOn: l.expiresOn,
      serials: l.serials,
    };
  });
}
