import { useState } from "react";
import type { Product } from "../commerce/models";
import { useCommerce } from "../commerce/CommerceContext";
import { OperationForm, useCommercialForm } from "../commerce/CommerceUi";
import { SelectField, TextField } from "../ui/Primitives";
import { fromBase, quantityLabel, unitLabels } from "./measures";
import type { Lot } from "./measures";

export function LotCorrection({ product, lot, close }: { product: Product; lot: Lot; close: () => void }) {
  const [kind, setKind] = useState(lot.held ? "release-lot" : lot.sellable ? "hold-lot" : "discard-lot");
  const [note, setNote] = useState("");
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  const unit = product.retail!.unit;
  return <OperationForm title={"Gestionar lote " + lot.lot} onClose={close} error={form.error} blocked={form.blocked}
    action="Confirmar cambio de lote" onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind, entityId: product.id, code: lot.lot, note }), (result) => showDocument(result.entityId));
    }}>
    <p>{product.name} · {quantityLabel(fromBase(lot.quantity, unit))} {unitLabels[unit]}</p>
    <SelectField label="Acción sobre el lote" value={kind} onChange={(event) => setKind(event.target.value)}>
      {lot.sellable && <option value="hold-lot">Apartar de la venta</option>}
      {lot.held && <option value="release-lot">Liberar para la venta</option>}
      <option value="discard-lot">Dar de baja todas las existencias del lote</option>
    </SelectField>
    <TextField label="Motivo de la corrección" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}
