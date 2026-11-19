import { useState } from "react";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, OperationForm, Pages, useCommercialForm } from "../commerce/CommerceUi";
import { bob, dateLabel } from "../commerce/models";
import type { Page, Product } from "../commerce/models";
import { Button, Card, DataTable, TextField } from "../ui/Primitives";
import { quantityLabel } from "./measures";
import type { Lot } from "./measures";

export function CementOpening({ product, close }: { product: Product; close: () => void }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const result = useCommerceData<Page<Lot>>("/lots/" + product.id + "?sellable=true&page=" + page);
  const lot = result.data?.items.find((item) => item.lot === selected);
  return <Card>
    <div className="page-heading"><h2>Abrir bolsas · {product.name}</h2>
      <Button variant="secondary" onClick={close}>Cerrar apertura</Button></div>
    {result.data ? <DataTable caption="Lotes de bolsas disponibles" columns={["Lote", "Vence", "Bolsas", "Valor", "Acción"]}
      rows={result.data.items.map((item) => ({ id: item.lot, cells: [item.lot, item.expiresOn ? dateLabel(item.expiresOn) : "—",
        item.quantity, bob(item.valueMinor), <Button variant="secondary" onClick={() => setSelected(item.lot)}>Elegir {item.lot}</Button>] }))} />
      : <LoadFeedback {...result} />}
    {result.data?.items.length === 0 && <p>Registra una compra de bolsas para abrir un lote vendible.</p>}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={(value) => { setSelected(undefined); setPage(value); }} />
    {lot && <OpenLot key={lot.lot} product={product} lot={lot} close={() => setSelected(undefined)} />}
  </Card>;
}

function OpenLot({ product, lot, close }: { product: Product; lot: Lot; close: () => void }) {
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  const [quantity, setQuantity] = useState("1");
  const bags = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  const kg = bags * (product.specialty?.material?.cement?.bagKg ?? 0);
  const valid = bags > 0 && bags <= lot.quantity && kg <= 1_000_000;
  const denominator = BigInt(lot.quantity);
  const cost = valid ? Number((BigInt(lot.valueMinor) * BigInt(bags) * 2n + denominator) / (2n * denominator)) : 0;

  return <OperationForm title={"Lote " + lot.lot} action="Confirmar apertura" error={form.error}
    blocked={form.blocked || !valid} onClose={close} onSubmit={(event) => {
      event.preventDefault();
      if (!valid) return;
      void form.submit(() => ({ kind: "open-cement", entityId: product.id, code: lot.lot, stockQuantity: bags, amountMinor: cost }),
        (result) => showDocument(result.entityId));
    }}>
    <TextField label="Bolsas a abrir" type="number" min={1} max={lot.quantity} step={1} required value={quantity}
      onChange={(event) => setQuantity(event.target.value)} />
    {valid && <p>{quantityLabel(kg)} kg a granel · {bob(cost)} de valor transferido</p>}
  </OperationForm>;
}
