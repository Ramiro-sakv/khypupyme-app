import { useState } from "react";
import { useCommerceData } from "../commerce/CommerceContext";
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
