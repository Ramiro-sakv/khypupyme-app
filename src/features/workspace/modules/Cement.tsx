import { useState } from "react";
import type { ReactNode } from "react";
import { compare, decimal, mul, withdrawCost } from "../../../../shared/workspace/exact";
import type { Quantity } from "../../../../shared/workspace/exact";
import type { Item } from "../../../../shared/workspace/model";
import { displayQuantity } from "../../../../shared/workspace/presentation";
import { useRecords, useWorkspace } from "../context";
import { useWorkspaceNavigation } from "../navigation";
import { ActionForm, Field, Pager } from "../ui";
import { bob, q, today } from "../format";

type CementLot = { id: string; lot: string; available: boolean; held?: boolean; expiresOn: string; balance: Quantity };

function UnpackBags() {
  const { run, busy } = useWorkspace();
  const [source, setSource] = useState(""), [target, setTarget] = useState(""), [lotId, setLot] = useState(""), [bags, setBags] = useState("");
  const origins = useRecords<Item>("items", { active: true, itemKind: "cement-bag" });
  const targets = useRecords<Item>("items", { active: true, itemKind: "cement-bulk" });
  const lots = useRecords<CementLot>("lots", source ? { itemId: source } : {}, !!source);
  const item = origins.items.find((entry) => entry.id === source);
  const allowedLots = lots.items.filter((row) => row.available && !row.held && (!row.expiresOn || row.expiresOn >= today()));
  const lot = allowedLots.find((row) => row.id === lotId);
  const destinations = targets.items.filter((row) => item && row.fields.brand === item.fields.brand && row.fields.grade === item.fields.grade);
  let preview: { kilograms: Quantity; value: number } | undefined;
  try {
    const quantity = q(bags);
    if (item && lot && quantity.d === "1" && Number(quantity.n) > 0 && compare(quantity, lot.balance) <= 0) {
      preview = { kilograms: mul(quantity, decimal(item.fields.weightKg!)), value: withdrawCost(item.valueMinor, item.balance, quantity) };
    }
  } catch { /* Mientras se escribe, se espera una cantidad válida. */ }

  return <details>
    <summary>Abrir bolsas a granel</summary>
    <ActionForm disabled={busy} label="Confirmar apertura" onSave={async () => {
      if (!preview || !destinations.some((entry) => entry.id === target))
        throw new Error("Elige el lote, una cantidad disponible y el destino compatible.");
      const result = await run({ kind: "unpack", input: { sourceId: source, targetId: target, lotId, bags: q(bags), expectedValueMinor: preview.value } });
      if (result) { setBags(""); setLot(""); }
    }}>
      <label>Bolsas de origen<select value={source} required onChange={(event) => { setSource(event.target.value); setTarget(""); setLot(""); }}>
        <option value="">Seleccionar producto</option>
        {origins.items.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.fields.weightKg} kg</option>)}
      </select></label>
      <Pager page={origins} />
      <label>Lote disponible<select value={lotId} required onChange={(e) => setLot(e.target.value)}>
        <option value="">Seleccionar lote</option>
        {allowedLots.map((entry) => <option key={entry.id} value={entry.id}>{entry.lot} · {displayQuantity(entry.balance)} bolsas</option>)}
      </select></label>
      {source && <Pager page={lots} />}
      <label>Producto a granel de destino<select value={target} required onChange={(e) => setTarget(e.target.value)}>
        <option value="">Seleccionar destino</option>
        {destinations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label>
      {source && <Pager page={targets} />}
      <Field name="bags" label="Bolsas completas a abrir" type="number" min={1} step="1" value={bags} onValueChange={setBags} />
      <p role="status">{preview ? `${displayQuantity(preview.kilograms)} kg · ${bob(preview.value)} a transferir · lote ${lot?.lot}`
        : "Selecciona un lote e indica las bolsas completas disponibles."}</p>
    </ActionForm>
  </details>;
}

export default function Cement({ children }: { children: ReactNode }) {
  const { business } = useWorkspace();
  const { view } = useWorkspaceNavigation();
  return <>
    {view === "inventario" && <section className="model-note">
      <h2>Bolsas y granel</h2>
      <p>Revisa el peso declarado, el lote y las existencias antes de abrir bolsas.</p>
      {business.answers.bulk && <UnpackBags />}
    </section>}
    {children}
  </>;
}
