import { AppError } from "../../../shared/app-errors.js";
import type { CartStock, StockCheck } from "../../../shared/workspace/availability.js";
import { add, compare, fraction, sub, ZERO } from "../../../shared/workspace/exact.js";
import type { Quantity } from "../../../shared/workspace/exact.js";
import type { SaleLineInputV2, WorkspaceBusiness } from "../../../shared/workspace/model.js";
import { CashService } from "./CashService.js";
import { Documents } from "./Documents.js";
import { InventoryServiceV2 } from "./InventoryService.js";
import type { Serial } from "./InventoryService.js";
import { TradeService } from "./TradeService.js";
import type { UnitOfWork } from "./UnitOfWork.js";

interface Demand {
  key: string;
  widthMm?: string;
  requested: Quantity;
  available: Quantity;
}

export async function cartAvailability(
  work: UnitOfWork,
  business: WorkspaceBusiness,
  lines: SaleLineInputV2[],
  quote: boolean,
): Promise<CartStock[]> {
  const selectionCount = lines.reduce((count, line) =>
    count + (line.timber?.widths.length ?? 0) + line.serials.length, 0);
  if (selectionCount > 100)
    throw new AppError("Divide la operación: admite hasta 100 medidas o series.");
  const inventory = new InventoryServiceV2(work, business, "availability");
  const trade = new TradeService(work, inventory, new CashService(work, "availability"),
    new Documents(work, business, "availability"), "availability");
  const totals = new Map<string, Quantity>();
  const seenSerials = new Set<string>();
  const planned: { demands: Demand[]; issue?: string }[] = [];
  for (const input of lines) {
    // The non-consuming plan resolves the same product, price and exact quantity as a sale.
    const line = await trade.planLine(input, false, "");
    const demands: Demand[] = [];
    let issue = "";
    if (line.timber) {
      for (const width of line.timber.widths) {
        const stock = await inventory.timber.stockForWidth(line.itemId, line.timber.lengthMm, width.widthMm);
        demands.push({
          key: JSON.stringify([line.itemId, line.timber.lengthMm, width.widthMm]),
          widthMm: width.widthMm,
          requested: fraction(BigInt(width.pieces), 1n),
          available: fraction(BigInt(stock?.pieces ?? 0), 1n),
        });
      }
    } else if (line.kind !== "service") {
      const item = await inventory.item(line.itemId);
      let available = item.balance;
      if (item.kind === "appliance" && !quote) {
        let valid = 0;
        for (const id of input.serials) {
          const serial = await work.get<Serial>("serials", id);
          if (serial?.itemId === item.id && serial.status === "available" && !seenSerials.has(id)) valid++;
          seenSerials.add(id);
        }
        if (String(valid) !== line.delivered.n || valid !== input.serials.length)
          issue = "Selecciona una serie disponible y distinta por cada equipo.";
      } else if (item.kind !== "appliance") {
        const lots = await inventory.availableLots(item.id);
        const eligible = lots.reduce((sum, lot) => add(sum, lot.balance), ZERO);
        if (compare(eligible, available) < 0) available = eligible;
      }
      demands.push({ key: item.id, requested: line.delivered, available });
    }
    for (const demand of demands)
      totals.set(demand.key, add(totals.get(demand.key) ?? ZERO, demand.requested));
    planned.push({ demands, ...(issue ? { issue } : {}) });
  }
  return planned.map(({ demands, issue }, index) => ({
    id: String(index),
    ...(issue ? { issue } : {}),
    checks: demands.map(({ key, available, widthMm }): StockCheck => {
      const requested = totals.get(key)!;
      return {
        ...(widthMm ? { widthMm } : {}),
        requested,
        available,
        missing: compare(requested, available) > 0 ? sub(requested, available) : ZERO,
      };
    }),
  }));
}
