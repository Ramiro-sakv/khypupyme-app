import { useState } from "react";
import type { components } from "../api/schema";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, SearchForm, useCommercialForm } from "../commerce/CommerceUi";
import { dateLabel, documentName } from "../commerce/models";
import type { Page } from "../commerce/models";
import type { Serial } from "./measures";

type UnitHistory = components["schemas"]["UnitHistory"];
const states: Record<string, string> = { available: "Disponible", sold: "Vendido", inspection: "En inspección", discarded: "Dado de baja" };
const movements: Record<string, string> = { released: "Inspección · volvió a existencias", discarded: "Inspección · baja" };

export function SerialHistory({ initial, filter }: { initial?: string; filter?: string }) {
  const [serial, setSerial] = useState(initial ?? "");
  const [state, setState] = useState(filter ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const response = useCommerceData<Page<Serial>>("/serials?" + new URLSearchParams({ search, page: String(page), ...(state ? { state } : {}) }));

  return <div className="commerce-stack"><CommerceHeading title="Series, garantías e inspección" />
    {serial && <UnitDetails key={serial} serial={serial} close={() => setSerial("")} />}
    <Card>
      <SearchForm label="Buscar número de serie" onSearch={(value) => { setSearch(value); setPage(1); }} />
      <SelectField label="Estado de la unidad" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}>
        <option value="">Todos</option>
        {Object.entries(states).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </SelectField>
      {!response.data ? <LoadFeedback {...response} /> : response.data.items.length === 0 ? <NoRecords>Recibe equipos con su número de serie desde Compras.</NoRecords> :
        <DataTable caption="Equipos registrados" columns={["Serie", "Producto", "Estado", "Garantía declarada", "Acción"]}
          rows={response.data.items.map((unit) => ({ id: unit.serial, cells: [
            unit.serial, unit.productName, states[unit.state],
            unit.warrantyUntil ? dateLabel(unit.warrantyUntil) : "—",
            <Button variant="secondary" onClick={() => setSerial(unit.serial)}>Ver historial</Button>,
          ] }))} />}
      <Pages index={page} hasMore={response.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}

function UnitDetails({ serial, close }: { serial: string; close: () => void }) {
  const data = useCommerceData<UnitHistory>("/serial?" + new URLSearchParams({ serial }));
  const { showDocument } = useCommerce();
  const [inspection, setInspection] = useState(false);
  return <Card className="commerce-stack">
    <div className="page-heading"><h2>Serie {serial}</h2><Button variant="plain" onClick={close}>Cerrar historial de la unidad</Button></div>
    {!data.data ? <LoadFeedback {...data} /> : <>
      <p>{data.data.unit.productName} · {states[data.data.unit.state]}</p>
      {data.data.unit.warrantyUntil && <p>Garantía declarada hasta {dateLabel(data.data.unit.warrantyUntil)}</p>}
      {data.data.unit.state === "inspection" && <>
        <Alert>La unidad está apartada hasta registrar el resultado de la inspección.</Alert>
        {inspection ? <InspectionEditor serial={serial} close={() => setInspection(false)} /> :
          <Button onClick={() => setInspection(true)}>Resolver inspección</Button>}
      </>}
      <DataTable caption="Movimientos de la unidad" columns={["Fecha", "Operación", "Detalle", "Comprobante"]}
        rows={data.data.movements.map((movement) => ({ id: movement.entryId, cells: [
          dateLabel(movement.date), movements[movement.kind] ?? documentName(movement.kind),
          [movement.note, movement.kind === "sale" && movement.warrantyUntil ? "Garantía hasta " + dateLabel(movement.warrantyUntil) : ""].filter(Boolean).join(" · "),
          <Button variant="secondary" onClick={() => showDocument(movement.entryId)}>{movement.number}</Button>,
        ] }))} />
    </>}
  </Card>;
}

function InspectionEditor({ serial, close }: { serial: string; close: () => void }) {
  const [result, setResult] = useState("available");
  const [note, setNote] = useState("");
  const form = useCommercialForm();
  return <OperationForm title="Resultado de la inspección" error={form.error} blocked={form.blocked} onClose={close} onSubmit={(event) => {
    event.preventDefault();
    void form.submit(() => ({ kind: "inspection", serial, release: result === "available", note }), close);
  }}>
    <SelectField label="Resultado" value={result} onChange={(event) => setResult(event.target.value)}><option value="available">Volver a existencias</option>
      <option value="discarded">Dar de baja por daño</option></SelectField>
    <TextField label="Motivo de la decisión" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}
