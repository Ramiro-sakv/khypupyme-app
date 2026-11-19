import { useRef, useState } from "react";
import { Alert, Button, Card, SelectField, TextField } from "../ui/Primitives";
import { ReviewDock } from "../ui/ReviewDock";
import { useCommerce } from "../commerce/CommerceContext";
import { PaymentField, useCommercialForm } from "../commerce/CommerceUi";
import { bob, moneyLimit } from "../commerce/models";
import type { EntryDocument, Product } from "../commerce/models";
import { describeLine, remainingQuantity } from "./measures";
import { VariantMatrix } from "./TradeFields";

export function ExchangeEditor({ document, close }: { document: EntryDocument; close: () => void }) {
  const eligible = document.lines.filter((line) => line.details?.apparel && remainingQuantity(line) > 0);
  const [lineId, setLineId] = useState(eligible[0]?.lineId);
  const [quantity, setQuantity] = useState("1");
  const [replacement, setReplacement] = useState<Product>();
  const [method, setMethod] = useState(document.method && document.method !== "credit" ? document.method : "cash");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  const original = eligible.find((line) => line.lineId === lineId);
  if (!original?.details?.apparel) return null;

  const count = Number(quantity);
  const valid = Number.isInteger(count) && count > 0 && count <= remainingQuantity(original);
  const refund = valid ? portion(original.subtotalMinor, original.returnedQuantity, count, original.quantity) : null;
  const total = valid && replacement && replacement.priceMinor * count <= moneyLimit ? replacement.priceMinor * count : null;
  const debt = Math.min(refund ?? 0, document.debtBalanceMinor);
  const difference = total === null || refund === null ? null : total - (refund - debt);
  const sufficient = !!replacement && replacement.stock >= count;
  const key = JSON.stringify([lineId, count, replacement?.id, replacement?.priceMinor, difference, method]);
  const totalText = difference === null ? "Pendiente" : difference === 0 ? "Sin diferencia" :
    (difference > 0 ? "A cobrar " : "A devolver ") + bob(Math.abs(difference));

  return <Card className="store-line">
    <div className="page-heading"><h2 ref={title} tabIndex={-1}>Cambio desde {document.number}</h2><Button variant="plain" onClick={close}>Cancelar cambio</Button></div>
    <SelectField label="Variante devuelta" value={lineId} onChange={(event) => { setLineId(event.target.value); setReplacement(undefined); setQuantity("1"); }}>
      {eligible.map((line) => <option key={line.lineId} value={line.lineId}>{describeLine(line)}</option>)}
    </SelectField>
    <TextField label={original.details.specialty?.countUnit === "pair" ? "Pares para cambiar" : "Piezas para cambiar"} type="number" min={1} max={remainingQuantity(original)} value={quantity} step={1}
      onChange={(event) => setQuantity(event.target.value)} />
    <h3>Elige la talla y el color de reemplazo</h3>
    <VariantMatrix key={original.lineId} model={original.details.apparel.model} excluded={original.productId}
      disabled={form.blocked} requireStock choose={setReplacement} />
    {replacement?.apparel && <p>Talla {replacement.apparel.size} · {replacement.apparel.color} · {replacement.stock} disponibles</p>}
    {replacement && !sufficient && <Alert tone="error">Pediste {count}, hay {replacement.stock} y faltan {count - replacement.stock}
      {original.details.specialty?.countUnit === "pair" ? " pares" : " piezas"} de esta variante.</Alert>}
    <ReviewDock total={totalText} cartFocus={title}>
      <form className="account-form" onSubmit={(event) => {
        event.preventDefault();
        if (difference === null || !sufficient || reviewed !== key || !replacement) return;
        void form.submit(() => ({ kind: "exchange", sourceId: document.id, method, note, amountMinor: difference,
          lines: [{ productId: original.productId, originalLineId: original.lineId, quantity: count }],
          exchangeLines: [{ productId: replacement.id, quantity: count, unitMinor: replacement.priceMinor }],
        }), (result) => showDocument(result.entityId));
      }}>
        {refund !== null && <p>Crédito del producto devuelto · {bob(refund)}</p>}
        {debt > 0 && <p>Aplicado al fiado · {bob(debt)}</p>}
        {total !== null && <p>Reemplazo · {bob(total)}</p>}
        <TextField label="Motivo del cambio" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
        <PaymentField value={method} onChange={setMethod} />
        {form.error && <Alert tone="error">{form.error}</Alert>}
        <label className="trade-check"><input type="checkbox" disabled={difference === null || !sufficient} checked={reviewed === key}
          onChange={(event) => setReviewed(event.target.checked ? key : "")} />He revisado la diferencia</label>
        <Button type="submit" disabled={difference === null || !sufficient || reviewed !== key || form.blocked}>Confirmar cambio</Button>
      </form>
    </ReviewDock>
  </Card>;
}

function portion(amount: number, before: number, count: number, total: number) {
  const divisor = BigInt(total);
  const at = (index: number) => (2n * BigInt(amount) * BigInt(index) + divisor) / (2n * divisor);
  return Number(at(before + count) - at(before));
}
