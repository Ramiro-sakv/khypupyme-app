import { useEffect, useState } from "react";
import type { CartStock } from "../../../shared/workspace/availability";
import { errorMessage } from "../../shared/errors";
import { linePrice, saleInputs } from "./Cart";
import type { CartLine } from "./Cart";
import { useWorkspace } from "./context";

export function useCartAvailability(lines: CartLine[], purchase: boolean, quote: boolean) {
  const { business, repository, revision } = useWorkspace();
  const indexed = purchase ? [] : lines.flatMap((line, index) => {
    if ("issue" in linePrice(line, false)) return [];
    try {
      return [{ index, input: saleInputs([line])[0]! }];
    } catch {
      return [];
    }
  });
  const payload = JSON.stringify(indexed.map(({ input }) => input));
  const enabled = indexed.length > 0;
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([business.id, revision, quote, payload, attempt]);
  const [response, setResponse] = useState<{ key: string; items: CartStock[]; error: string }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void repository.list<CartStock>({
        apiVersion: 2, businessId: business.id, resource: "cartAvailability", lines: JSON.parse(payload), quote,
      }).then(({ items }) => {
        if (active) setResponse({ key, items, error: "" });
      }).catch((cause) => {
        if (active) setResponse({ key, items: [], error: errorMessage(cause, "No se pudo consultar la disponibilidad.") });
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [business.id, repository, enabled, payload, quote, key]);

  const current = enabled && response?.key === key ? response : undefined;
  const affected = current?.items.filter((line) => line.issue || line.checks.some((check) => check.missing.n !== "0")).length ?? 0;
  const waiting = enabled && !current;
  const error = current?.error ?? "";
  const ready = purchase || quote || (!!current && !error && !affected &&
    current.items.length === indexed.length && indexed.length === lines.length);
  const message = error || (waiting ? "Comprobando disponibilidad…"
    : affected ? (quote ? "Hay artículos con stock insuficiente. La cotización puede guardarse."
      : "Revisa el stock o las series en las líneas marcadas.") : "");
  return {
    ready, affected, error, message,
    retry: () => setAttempt((value) => value + 1),
    rows: new Map(indexed.map(({ index }, position) => [index, current?.items[position]])),
  };
}
