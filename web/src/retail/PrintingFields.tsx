import type { components } from "../api/schema";
import { SelectField, TextField } from "../ui/Primitives";

export type PrintDraft = { copies: string; facesPerCopy: string; duplex: boolean };

export function previewPrinting(draft?: PrintDraft) {
  if (!draft || !/^\d{1,7}$/.test(draft.copies) || !/^\d{1,7}$/.test(draft.facesPerCopy)) return null;
  const copies = Number(draft.copies);
  const facesPerCopy = Number(draft.facesPerCopy);
  const faces = copies * facesPerCopy;
  if (copies <= 0 || facesPerCopy <= 0 || faces > 1_000_000) return null;
  const job: components["schemas"]["PrintingInput"] = { copies, facesPerCopy, duplex: draft.duplex };
  return { job, faces, sheets: copies * (draft.duplex ? Math.ceil(facesPerCopy / 2) : facesPerCopy) };
}

export function PrintingFields({ value, update, disabled }: { value: PrintDraft; update: (value: PrintDraft) => void; disabled: boolean }) {
  const computed = previewPrinting(value);
  return <>
    <div className="store-fields">
      <TextField label="Número de copias" inputMode="numeric" value={value.copies} disabled={disabled}
        onChange={(event) => update({ ...value, copies: event.target.value })} />
      <TextField label="Caras por copia" hint="Número de páginas que se imprimen en cada copia." inputMode="numeric"
        value={value.facesPerCopy} disabled={disabled} onChange={(event) => update({ ...value, facesPerCopy: event.target.value })} />
      <SelectField label="Modo de impresión" value={value.duplex ? "duplex" : "single"} disabled={disabled}
        onChange={(event) => update({ ...value, duplex: event.target.value === "duplex" })}>
        <option value="single">Una cara</option><option value="duplex">Doble cara</option>
      </SelectField>
    </div>
    <p>{computed ? computed.faces + " caras impresas · " + computed.sheets + " hojas" : "Completa las copias y las caras por copia."}</p>
  </>;
}
