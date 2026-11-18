import { useEffect, useState } from "react";
import { get } from "../api/client";
import { useCommerce } from "../commerce/CommerceContext";
import { moneyLimit, parseMoney } from "../commerce/models";
import type { CommandLine, Page, Product } from "../commerce/models";
import { captureTimber, exactVolume, measureKey, timberAmount, timberRate } from "./measures";
import type { Capture, Dimensions, Rates, StockRow } from "./measures";

export type TimberLine = { id: string; timber: Capture; rates?: Rates; cost: string };
export type WidthOrder = { timber: Dimensions; quantity: number; charged: number; subtotal: number | null };

export const stockKey = (id: string, timber: Dimensions) => id + ":" + measureKey(timber);

export function prepareTimber(lines: TimberLine[], products: Record<string, Product> | undefined, purchase: boolean) {
  const combined = new Map<string, CommandLine & { timber: Dimensions; unitMinor: number }>();
  let problem = "";
  const captured = lines.map((line) => {
    const capture = captureTimber(line.timber);
    const rates = line.rates ?? products?.[line.id]?.timber;
    const widths = capture.rows.map((row) => {
      const unit = purchase ? parseMoney(line.cost) : rates ? timberRate(rates, row.timber) : null;
      const key = stockKey(line.id, row.timber);
      const previous = combined.get(key);
      const quantity = (previous?.quantity ?? 0) + row.quantity;
      const current = products?.[line.id]?.timber;
      if (!purchase && unit !== null && current && timberRate(current, row.timber) !== unit)
        problem ||= "Cambiaron las tarifas de " + products?.[line.id].name + ". Actualízalas y vuelve a revisar.";
      if (previous && previous.unitMinor !== unit) problem ||= "Usa el mismo costo para las piezas de una medida dentro de esta compra.";
      if (quantity > 1_000_000) problem ||= "Una medida supera 1.000.000 de piezas.";
      if (unit !== null) combined.set(key, { productId: line.id, timber: row.timber, quantity, unitMinor: unit });
      return { ...row, unit, key };
    });
    return { ...capture, widths };
  });
  const commands = [...combined.values()];
  const ordered = [...commands].sort((left, right) => left.timber.widthMicros - right.timber.widthMicros);
  const cumulative = new Map<string, { volume: bigint; rounded: number }>();
  const subtotals = new Map<string, number>();
  let gross = 0;
  for (const row of ordered) {
    const group = [row.productId, row.timber.lengthMicros, row.timber.thicknessMicros, row.unitMinor].join(":");
    const previous = cumulative.get(group);
    const volume = (previous?.volume ?? 0n) + exactVolume(row.timber, row.quantity);
    const rounded = timberAmount(volume, row.unitMinor);
    const subtotal = purchase ? row.quantity * row.unitMinor : rounded - (previous?.rounded ?? 0);
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

export function useTimberAvailability(lines: ReturnType<typeof prepareTimber>["commands"], enabled: boolean) {
  const { path, revision } = useCommerce();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; stock?: Record<string, number>; error?: string }>();
  const groups = new Map<string, Set<number>>();
  if (enabled && lines.length <= 100) {
    for (const row of lines) {
      const query = "/timber-stock/" + row.productId + "?length=" + row.timber.lengthMicros + "&thickness=" + row.timber.thicknessMicros;
      const widths = groups.get(query) ?? new Set<number>();
      widths.add(row.timber.widthMicros);
      groups.set(query, widths);
    }
  }
  const query = JSON.stringify([...groups].sort(([a], [b]) => a.localeCompare(b))
    .map(([group, widths]) => group + "&widths=" + [...widths].sort((a, b) => a - b).join(",")));
  const key = [path, query, revision, attempt].join("@");
  useEffect(() => {
    const requests = JSON.parse(query) as string[];
    if (!requests.length) return;
    const abort = new AbortController();
    void Promise.all(requests.map(async (request) => {
      const productId = request.slice("/timber-stock/".length, request.indexOf("?"));
      const data = await get<Page<StockRow>>(path + request, abort.signal);
      if (data.hasMore) throw new Error("Reduce las medidas y consulta las existencias otra vez.");
      return data.items.map((row) => [stockKey(productId, row.timber), row.stock] as const);
    })).then((result) => {
      if (!abort.signal.aborted) setState({ key, stock: Object.fromEntries(result.flat()) });
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "No se pudieron consultar las medidas." });
    });
    return () => abort.abort();
  }, [key, path, query]);
  return {
    loading: groups.size > 0 && state?.key !== key,
    ...(state?.key === key ? state : {}),
    retry: () => setAttempt((current) => current + 1),
  };
}
