import { timberCategory } from "../../../shared/workspace/timber-species";
import type { TimberWidthEntry } from "../../../shared/workspace/timber-width-entry";
import { requireTimber } from "./TimberWidthEntry";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import type { TimberSaleSelection } from "../../../shared/workspace/model";
import { amount, ceil, div, fraction, mul, whole } from "../../../shared/workspace/exact";
import { isDiscrete } from "../../../shared/workspace/catalog";
import { commercialQuantity } from "../../../shared/workspace/validation";
import type {
  Item,
  ReceiptLineInput,
  SaleLineInputV2,
  Unit,
} from "../../../shared/workspace/model";
import { cents, q } from "./format";

export interface CartLine {
  packages?: SaleLineInputV2["packages"];
  print?: SaleLineInputV2["print"];
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

export function linePrice(line: CartLine, purchase: boolean) {
  const timber = line.item.kind === "timber-grouped";
  const unit = timber ? "boardFoot" : purchase ? line.unit : line.item.priceUnit;
  let unitMinor: number;
  let quantity;
  if (purchase && !line.cost.trim()) return { issue: "Falta indicar el costo unitario." } as const;
  try {
    unitMinor = purchase ? cents(line.cost) : timber ? requireTimber(line).priceMinor : line.item.priceMinor;
    if (unitMinor <= 0) return { issue: purchase ? "Indica un costo unitario mayor que cero." : "Revisa el precio unitario." } as const;
  } catch {
    return { issue: purchase ? "Indica un costo válido en BOB." : "Completa las medidas y el precio de la madera." } as const;
  }
  try {
    if (timber) {
      quantity = timberTotals(line.item.fields.thicknessMm!, requireTimber(line)).boardFeet;
    } else {
      const entered = commercialQuantity(q(line.qty), false);
      const conversion = line.item.units[line.unit];
      if (!conversion || (line.unit === "roll" && !whole(entered)) ||
          (isDiscrete(line.item) && (purchase ? !whole(mul(entered, conversion)) : !whole(delivered(line)))))
        return { issue: "Indica una cantidad válida para esta unidad." } as const;
      quantity = purchase ? entered : div(delivered(line), line.item.units[unit]!);
    }
  } catch {
    return { issue: timber ? "Completa las medidas de la madera." : "Indica una cantidad válida para esta unidad." } as const;
  }
  try {
    const subtotal = amount(unitMinor, quantity);
    return { unit, unitMinor, subtotal } as const;
  } catch {
    return { issue: "El subtotal supera el límite permitido." } as const;
  }
}
export function saleInputs(lines: CartLine[]): SaleLineInputV2[] {
  return lines.map((l) => {
    const timber =
      l.item.kind === "timber-grouped" ? requireTimber(l) : undefined;
    return {
      ...(timber ? { timber } : {}),
      ...(l.packages ? { packages: l.packages } : {}),
      ...(l.print ? { print: l.print } : {}),
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
