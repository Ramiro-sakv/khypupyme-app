import { useEffect, useState } from "react";
import { get } from "../api/client";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, Pages } from "../commerce/CommerceUi";
import type { Page, Product } from "../commerce/models";
import { SelectField } from "../ui/Primitives";
import { fromBase, quantityLabel, unitLabels } from "./measures";
import type { Lot } from "./measures";

export function PetLotField({ product, lot, disabled, onChange }: { product: Product; lot?: string | null;
  disabled: boolean; onChange: (lot: string | undefined) => void }) {
  const [page, setPage] = useState(1);
  const recent = useCommerceData<Page<Lot>>("/lots/" + product.id + "?sellable=true&page=" + page);
  const unit = product.retail!.unit;
  return <>
    <SelectField label="Lote de origen" value={lot ?? ""} disabled={disabled}
      onChange={(event) => onChange(event.target.value || undefined)}>
      <option value="">Asignar el lote vendible que vence antes</option>
      {lot && !recent.data?.items.some((item) => item.lot === lot) && <option value={lot}>{lot}</option>}
      {recent.data?.items.map((item) => <option key={item.lot} value={item.lot}>
        {item.lot} · {quantityLabel(fromBase(item.quantity, unit))} {unitLabels[unit]}
      </option>)}
    </SelectField>
    {!recent.data && <LoadFeedback {...recent} />}
    <Pages index={page} hasMore={recent.data?.hasMore} onChange={setPage} />
  </>;
}

export function useSelectedLots(lines: { id: string; lot: string }[]) {
  const { path, revision } = useCommerce();
  const [retry, setRetry] = useState(0);
  const query = JSON.stringify(lines);
  const key = [path, revision, retry, query].join("@");
  const [state, setState] = useState<{ key: string; stock?: Record<string, number>; error?: string }>();
  useEffect(() => {
    const current = JSON.parse(query) as typeof lines;
    if (!current.length) return;
    const abort = new AbortController();
    void Promise.all(current.map(async ({ id, lot }) => {
      const result = await get<Page<Lot>>(path + "/lots/" + id + "?" + new URLSearchParams({ lot, sellable: "true" }), abort.signal);
      return [id, result.items[0]?.quantity ?? 0] as const;
    })).then((rows) => {
      if (!abort.signal.aborted) setState({ key, stock: Object.fromEntries(rows) });
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "No se pudo consultar el lote de origen." });
    });
    return () => abort.abort();
  }, [path, key, query]);
  return { ...(state?.key === key ? state : {}), reload: () => setRetry((current) => current + 1) };
}
