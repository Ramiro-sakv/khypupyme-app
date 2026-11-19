import { useState } from "react";
import { Button, TextField } from "../ui/Primitives";
import { OperationForm, useCommercialForm } from "../commerce/CommerceUi";
import { parseMoney } from "../commerce/models";

type Row = { id: string; code: string; size: string; color: string; amount: string };
const blank = (): Row => ({ id: crypto.randomUUID(), code: "", size: "", color: "", amount: "" });

export function VariantBatch({ close, automatic = false }: { close: () => void; automatic?: boolean }) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [rows, setRows] = useState(() => [blank(), blank()]);
  const form = useCommercialForm();
  function edit(id: string, field: Exclude<keyof Row, "id">, value: string) {
    setRows((items) => items.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }
  return <OperationForm title="Crear variantes de un modelo" action="Guardar variantes" onClose={close}
    error={form.error} blocked={form.blocked} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({
        kind: "variants", name, code: model, variants: rows.map(({ id, code, size, color, amount }) => {
          const amountMinor = parseMoney(amount);
          if (amountMinor === null) throw new Error("Cada variante necesita un precio válido. [400]");
          return { id, code, size, color, amountMinor };
        }),
      }), close);
    }}>
    <div className="wizard-options">
      <TextField label="Nombre del producto" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      <TextField label="Modelo" required maxLength={80} value={model} onChange={(event) => setModel(event.target.value)} />
    </div>
    {rows.map((row, index) => <fieldset className="variant-entry" key={row.id}>
      <legend>Variante {index + 1}</legend>
      <div className="wizard-options">
        <TextField label="Código" value={row.code} required={!automatic} hint={automatic ? "Opcional. Se genera si queda vacío." : undefined} maxLength={40} onChange={(event) => edit(row.id, "code", event.target.value)} />
        <TextField label="Talla" value={row.size} required maxLength={24} onChange={(event) => edit(row.id, "size", event.target.value)} />
        <TextField label="Color" value={row.color} required maxLength={40} onChange={(event) => edit(row.id, "color", event.target.value)} />
        <TextField label="Precio (Bs)" value={row.amount} inputMode="decimal" required onChange={(event) => edit(row.id, "amount", event.target.value)} />
      </div>
      {rows.length > 1 && <Button variant="plain" onClick={() => setRows((items) => items.filter((item) => item.id !== row.id))}>Quitar variante</Button>}
    </fieldset>)}
    <Button variant="secondary" icon="plus" disabled={rows.length >= 20}
      onClick={() => setRows((items) => [...items, blank()])}>Añadir otra variante</Button>
  </OperationForm>;
}
