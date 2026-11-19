import { moneyLimit, parseMoney } from "../commerce/models";
import type { CommandLine, Product } from "../commerce/models";
import { captureTimber, exactVolume, measureKey, timberAmount, timberRate } from "./measures";
import type { Capture, Dimensions, Rates } from "./measures";

export type TimberLine = { id: string; timber: Capture; rates?: Rates; cost: string; timberCostUnit?: "board-foot"; manualPrice?: string };
export type WidthOrder = { timber: Dimensions; quantity: number; charged: number; subtotal: number | null };

export const stockKey = (id: string, timber: Dimensions) => id + ":" + measureKey(timber);

export function prepareTimber(lines: TimberLine[], products: Record<string, Product> | undefined, purchase: boolean) {
  const combined = new Map<string, CommandLine & { timber: Dimensions; unitMinor: number }>();
  let problem = "";
  const captured = lines.map((line) => {
    const capture = captureTimber(line.timber);
    const rates = line.rates ?? products?.[line.id]?.timber;
    const manual = !purchase && !!line.manualPrice?.trim();
    const override = manual ? parseMoney(line.manualPrice!) : null;
    const widths = capture.rows.map((row) => {
      const unit = purchase ? parseMoney(line.cost) : manual ? override : rates ? timberRate(rates, row.timber) : null;
      const key = stockKey(line.id, row.timber);
      const previous = combined.get(key);
      const quantity = (previous?.quantity ?? 0) + row.quantity;
      const current = products?.[line.id]?.timber;
      if (!purchase && !manual && unit !== null && current && timberRate(current, row.timber) !== unit)
        problem ||= "Cambiaron las tarifas de " + products?.[line.id].name + ". Actualízalas y vuelve a revisar.";
      if (previous && (previous.unitMinor !== unit || Boolean(previous.timberRateManual) !== manual || previous.timberCostUnit !== (purchase ? line.timberCostUnit : undefined)))
        problem ||= "Usa la misma tarifa para todas las piezas de una medida en este comprobante.";
      if (quantity > 1_000_000) problem ||= "Una medida supera 1.000.000 de piezas.";
      if (unit !== null) combined.set(key, { productId: line.id, timber: row.timber, quantity, unitMinor: unit, timberRateManual: manual || undefined,
        timberCostUnit: purchase ? line.timberCostUnit : undefined });
      return { ...row, unit, key };
    });
    return { ...capture, error: capture.error || (manual && override === null ? "Introduce una tarifa válida con hasta dos decimales." : ""), widths };
  });
  const commands = [...combined.values()];
  const ordered = [...commands].sort((left, right) => left.timber.widthMicros - right.timber.widthMicros);
  const cumulative = new Map<string, { volume: bigint; rounded: number }>();
  const subtotals = new Map<string, number>();
  let gross = 0;
  for (const row of ordered) {
    const group = [row.productId, row.timber.lengthMicros, row.timber.thicknessMicros, row.unitMinor, row.timberCostUnit].join(":");
    const previous = cumulative.get(group);
    const volume = (previous?.volume ?? 0n) + exactVolume(row.timber, row.quantity);
    const rounded = timberAmount(volume, row.unitMinor);
    const subtotal = purchase && !row.timberCostUnit ? row.quantity * row.unitMinor : rounded - (previous?.rounded ?? 0);
    cumulative.set(group, { volume, rounded });
    subtotals.set(stockKey(row.productId, row.timber), subtotal);
    gross += subtotal;
  }
  const allocated = new Map<string, number>();
  const groups = captured.map(({ widths, ...capture }) => {
    const rows = widths.map(({ timber, quantity, unit, key }): WidthOrder => {
      if (unit === null) return { timber, quantity, charged: 0, subtotal: null };
      const already = allocated.get(key) ?? 0;
      const amount = BigInt(subtotals.get(key) ?? 0);
      const all = BigInt(combined.get(key)!.quantity);
      const share = (pieces: number) => (2n * amount * BigInt(pieces) + all) / (2n * all);
      allocated.set(key, already + quantity);
      return { timber, quantity, charged: unit, subtotal: Number(share(already + quantity) - share(already)) };
    });
    const total = rows.length && rows.every((row) => row.subtotal !== null)
      ? rows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0) : null;
    return { ...capture, rows, total };
  });
  if (combined.size > 100 || gross > moneyLimit) problem ||= "Divide la operación. Se admiten hasta 100 medidas y un importe máximo de Bs 10.000.000.000.";
  return { groups, gross, problem, commands, requested: combined };
}
