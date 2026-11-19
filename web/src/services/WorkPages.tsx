import { useState } from "react";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, SearchForm, useCommercialForm } from "../commerce/CommerceUi";
import { bob, dateLabel } from "../commerce/models";
import type { Page } from "../commerce/models";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { WorkEditor } from "./WorkEditor";
import { canBillWork, clockTime, detailKeys, detailLabels, todayInBolivia, workNavigation, workStatus } from "./work";
import type { Work } from "./work";

const workFilters = {
  today: "De hoy", upcoming: "Próximos siete días", overdue: "Atrasados", billable: "Listos para cobrar",
  "waiting-parts": "En espera de repuestos", cancelled: "Citas canceladas",
};

export function WorkList({ industry, focus, open }: { industry: string; focus: string; open: (id: string) => void }) {
  const appointment = industry === "beauty";
  const config = workNavigation[industry];
  const [day, setDay] = useState(appointment && (!focus || focus === "new") ? todayInBolivia() : "");
  const [filter, setFilter] = useState(Object.hasOwn(workFilters, focus) ? focus : "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(focus === "new");
  const query = new URLSearchParams({ page: String(page), search });
  if (day) query.set("day", day);
  if (filter) query.set("filter", filter);
  const result = useCommerceData<Page<Work>>("/work?" + query);
  return <div className="commerce-stack">
    <CommerceHeading title={config.title}><Button icon="plus" onClick={() => setCreating(true)} disabled={creating}>
      {config.create}</Button></CommerceHeading>
    {creating && <WorkEditor industry={industry} initialDay={day >= todayInBolivia() ? day : undefined}
      close={() => setCreating(false)} onSaved={open} />}
    <Card>
      <div className="inventory-controls">
        <SearchForm label={appointment ? "Buscar cita o cliente" : "Buscar orden, cliente o dirección"}
          onSearch={(value) => { setSearch(value); setPage(1); }} />
        <TextField label="Filtrar por fecha" type="date" value={day} onChange={(event) => { setDay(event.target.value); setPage(1); }} />
        <SelectField label="Ver registros" value={filter} onChange={(event) => { setFilter(event.target.value); setDay(""); setPage(1); }}>
          <option value="">Todos</option>
          {Object.entries(workFilters).filter(([id]) => (id !== "cancelled" || appointment) &&
            (id !== "waiting-parts" || industry === "repair")).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </SelectField>
      </div>
      {!result.data ? <LoadFeedback {...result} /> : result.data.items.length === 0 ? <NoRecords>{search || filter ? "Prueba otra búsqueda o cambia los filtros." : "Elige otra fecha o crea un registro."}</NoRecords> :
        <DataTable caption={config.title} columns={[appointment ? "Cita" : "Trabajo", "Cliente", "Fecha y estado", "Presupuesto", "Acción"]}
          rows={result.data.items.map((row) => ({ id: row.id, cells: [
            <>{row.title}{row.address && <small className="record-secondary">{row.address}</small>}</>, row.customerName,
            <>{schedule(row)}<small className="record-secondary">{workStatus(row)}{row.saleId && " · Venta vinculada"}</small></>,
            row.budgetMinor == null ? "—" : bob(row.budgetMinor),
            <Button variant="secondary" onClick={() => open(row.id)}>Abrir</Button>,
          ] }))} />}
      <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}

function schedule(row: Work) {
  return dateLabel(row.day) + (row.startMinute == null ? "" :
    " · " + clockTime(row.startMinute) + " – " + clockTime(row.startMinute + (row.duration ?? 0)));
}

export function WorkDetail({ id, back, charge, openInventory }: {
  id: string; back: () => void; charge: (id: string) => void; openInventory: () => void;
}) {
  const result = useCommerceData<Work>("/work/" + id);
  return <div className="commerce-stack">
    <CommerceHeading title={result.data?.title ?? "Detalle de trabajo"}>
      <Button variant="secondary" icon="back" onClick={back}>Volver al listado</Button></CommerceHeading>
    {result.data ? <WorkDetailBody key={result.data.revision} item={result.data} charge={charge} openInventory={openInventory} /> : <LoadFeedback {...result} />}
  </div>;
}

function WorkDetailBody({ item, charge, openInventory }: { item: Work; charge: (id: string) => void; openInventory: () => void }) {
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  const [editing, setEditing] = useState(false);
  const [noteAction, setNoteAction] = useState<"cancelled" | "waiting-parts">();
  const [note, setNote] = useState("");
  const link = { id: item.id, revision: item.revision };
  const appointment = item.industry === "beauty";
  const canEdit = !item.saleId && !["attended", "no-show", "delivered", "cancelled"].includes(item.state);
  const primary = nextStep(item);
  const service = useCommerceData<{ name: string }>(item.serviceId ? "/products/" + item.serviceId : null);
  return <>
    <Card>
      <div className="page-heading"><h2>{workStatus(item)}</h2>{item.saleId && <strong>Venta vinculada</strong>}</div>
      <dl className="business-summary">
        <dt>Cliente</dt><dd>{item.customerName}</dd>
        <dt>{appointment ? "Fecha y hora" : "Fecha comprometida"}</dt><dd>{schedule(item)}</dd>
        {item.duration != null && <><dt>Duración</dt><dd>{item.duration} minutos</dd></>}
        {service.data && <><dt>Servicio</dt><dd>{service.data.name}</dd></>}
        {item.address && <><dt>Dirección</dt><dd>{item.address}</dd></>}
        {item.budgetMinor != null && <><dt>Presupuesto</dt><dd>{bob(item.budgetMinor)}</dd></>}
        {item.deliveredOn && <><dt>Entregado el</dt><dd>{dateLabel(item.deliveredOn)}</dd></>}
        {detailKeys.map((field) => item.details[field] && <div className="work-summary-row" key={field}>
          <dt>{detailLabels[field]}</dt><dd>{item.details[field]}</dd></div>)}
      </dl>
      {item.industry === "cleaning" && (item.details.billableMaterials || item.details.internalMaterials) &&
        <p>Los materiales cobrados figuran en la venta vinculada. Los de consumo interno se registran en Inventario con su motivo.</p>}
      <div className="inline-actions">
        {item.industry === "cleaning" && item.details.internalMaterials &&
          <Button variant="secondary" onClick={openInventory}>Ir a Inventario</Button>}
        {canEdit && <Button variant="secondary" disabled={editing || noteAction != null || form.blocked} onClick={() => setEditing(true)}>
          {appointment ? "Reprogramar cita" : "Editar orden"}</Button>}
        {primary && <Button variant="secondary" disabled={editing || noteAction != null || form.blocked || primary.blocked}
          onClick={() => void form.submit(() => ({ kind: "advance-work", workLink: link, workState: primary.state }), () => undefined)}>
          {primary.label}</Button>}
        {appointment && item.state === "scheduled" && item.day <= todayInBolivia() &&
          <Button variant="plain" disabled={editing || noteAction != null || form.blocked}
            onClick={() => void form.submit(() => ({ kind: "advance-work", workLink: link, workState: "no-show" }), () => undefined)}>
            Registrar inasistencia</Button>}
        {appointment && item.state === "scheduled" && <Button variant="plain" disabled={editing || noteAction != null || form.blocked}
          onClick={() => { setNote(""); setNoteAction("cancelled"); }}>Cancelar cita</Button>}
        {item.industry === "repair" && item.state === "working" && <Button variant="secondary" disabled={editing || noteAction != null || form.blocked}
          onClick={() => { setNote(""); setNoteAction("waiting-parts"); }}>Poner en espera de repuesto</Button>}
        {item.industry === "repair" && <Button variant="secondary" disabled={editing || noteAction != null || form.blocked}
          onClick={() => item.receiptId ? showDocument(item.receiptId) :
            void form.submit(() => ({ kind: "repair-receipt", workLink: link }), (result) => showDocument(result.entityId))}>
          {item.receiptId ? "Ver constancia de recepción" : "Emitir constancia de recepción"}</Button>}
        {!appointment && item.industry !== "repair" && <Button variant="secondary" disabled={editing || noteAction != null || form.blocked}
          onClick={() => void form.submit(() => ({ kind: "work-receipt", workLink: link }), (result) => showDocument(result.entityId))}>
          Emitir constancia de trabajo
        </Button>}
        {item.saleId ? <Button onClick={() => showDocument(item.saleId!)}>Ver venta vinculada</Button> :
          canBillWork(item) && <Button disabled={editing || noteAction != null || form.blocked} onClick={() => charge(item.id)}>Cobrar con una venta</Button>}
      </div>
      {primary?.hint && <p>{primary.hint}</p>}
      {form.error && <Alert tone="error">{form.error}</Alert>}
    </Card>
    {noteAction && <OperationForm title={noteAction === "cancelled" ? "Cancelar cita" : "Espera de repuesto"}
      action={noteAction === "cancelled" ? "Confirmar cancelación" : "Guardar espera"}
      blocked={form.blocked} error={form.error} onClose={() => setNoteAction(undefined)} onSubmit={(event) => {
        event.preventDefault();
        void form.submit(() => ({ kind: "advance-work", workLink: link, workState: noteAction, note }), () => setNoteAction(undefined));
      }}>
      <p>{noteAction === "cancelled" ? "Se libera el horario y la cita queda en el historial." :
        "La orden seguirá abierta y podrás reanudarla cuando llegue el repuesto."}</p>
      <TextField label={noteAction === "cancelled" ? "Motivo de cancelación" : "Repuesto pendiente"}
        value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} required />
    </OperationForm>}
    {editing && <WorkEditor industry={item.industry} record={item} close={() => setEditing(false)} onSaved={() => setEditing(false)} />}
  </>;
}

function nextStep(item: Work): { state: string; label: string; blocked?: boolean; hint?: string } | undefined {
  switch (item.state) {
    case "scheduled":
      if (item.industry === "beauty") return item.day <= todayInBolivia() ? { state: "attended", label: "Marcar atendida" } : undefined;
      if (item.industry === "professional") return approval(item);
      return { state: "working", label: "Iniciar trabajo" };
    case "received":
      return { state: "diagnosed", label: "Confirmar diagnóstico", blocked: !item.details.diagnosis,
        hint: !item.details.diagnosis ? "Guarda el diagnóstico desde Editar orden." : undefined };
    case "diagnosed": return approval(item);
    case "approved": return { state: "working", label: item.industry === "repair" ? "Iniciar reparación" : "Iniciar trabajo" };
    case "waiting-parts": return { state: "working", label: "Reanudar reparación" };
    case "working": return { state: "ready", label: "Marcar como listo" };
    case "ready": return { state: "delivered", label: "Confirmar entrega" };
  }
}
function approval(item: Work) {
  return { state: "approved", label: "Confirmar aprobación", blocked: item.budgetMinor == null,
    hint: item.budgetMinor == null ? "Guarda el presupuesto desde Editar orden." : undefined };
}
