import { useState } from "react";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, Pages, useCommercialForm } from "../commerce/CommerceUi";
import { bob, dateLabel } from "../commerce/models";
import type { Page } from "../commerce/models";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { WorkEditor } from "./WorkEditor";
import { canBillWork, clockTime, detailKeys, detailLabels, todayInBolivia, workNavigation, workStatus } from "./work";
import type { Work, WorkAttention } from "./work";

export function WorkPanel({ industry, open }: { industry: string; open: (focus: string) => void }) {
  const config = workNavigation[industry];
  const result = useCommerceData<WorkAttention>("/work-attention");
  const count = (value?: number) => value == null ? "" : " · " + value;
  return <Card className="industry-home-card">
    <h2>{config.title}</h2>
    <Button variant="secondary" onClick={() => open("new")}>{config.create}</Button>
    <Button variant="secondary" onClick={() => open("today")}>{config.today}{count(result.data?.today)}</Button>
    {industry !== "beauty" && <Button variant="secondary" onClick={() => open("overdue")}>
      Atrasados{count(result.data?.overdue)}</Button>}
    <Button variant="secondary" onClick={() => open("billable")}>Listos para cobrar{count(result.data?.readyToCharge)}</Button>
    {result.error && <Alert tone="error">{result.error}</Alert>}
  </Card>;
}

export function WorkList({ industry, focus, open }: { industry: string; focus: string; open: (id: string) => void }) {
  const appointment = industry === "beauty";
  const config = workNavigation[industry];
  const [day, setDay] = useState(focus === "today" || (appointment && focus !== "billable") ? todayInBolivia() : "");
  const [filter, setFilter] = useState(["overdue", "billable"].includes(focus) ? focus : "");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(focus === "new");
  const query = new URLSearchParams({ page: String(page) });
  if (day) query.set("day", day);
  if (filter) query.set("filter", filter);
  const result = useCommerceData<Page<Work>>("/work?" + query);
  return <div className="commerce-stack">
    <CommerceHeading title={config.title}><Button icon="plus" onClick={() => setCreating(true)} disabled={creating}>
      {config.create}</Button></CommerceHeading>
    {creating && <WorkEditor industry={industry} initialDay={day >= todayInBolivia() ? day : undefined}
      close={() => setCreating(false)} onSaved={open} />}
    <Card>
      <div className="store-fields">
        <TextField label="Filtrar por fecha" type="date" value={day} onChange={(event) => { setDay(event.target.value); setPage(1); }} />
        <SelectField label="Ver registros" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="">Todos</option><option value="overdue">Atrasados</option><option value="billable">Listos para cobrar</option>
        </SelectField>
      </div>
      {!result.data ? <LoadFeedback {...result} /> : result.data.items.length === 0 ? <NoRecords>Elige otra fecha o crea un registro.</NoRecords> :
        <DataTable caption={config.title} columns={[appointment ? "Cita" : "Trabajo", "Cliente", "Fecha y estado", "Acción"]}
          rows={result.data.items.map((row) => ({ id: row.id, cells: [
            <>{row.title}{row.address && <small className="record-secondary">{row.address}</small>}</>, row.customerName,
            <>{schedule(row)}<small className="record-secondary">{workStatus(row)}{row.saleId && " · Venta vinculada"}</small></>,
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

export function WorkDetail({ id, back, charge }: { id: string; back: () => void; charge: (id: string) => void }) {
  const result = useCommerceData<Work>("/work/" + id);
  return <div className="commerce-stack">
    <CommerceHeading title={result.data?.title ?? "Detalle de trabajo"}>
      <Button variant="secondary" icon="back" onClick={back}>Volver al listado</Button></CommerceHeading>
    {result.data ? <WorkDetailBody key={result.data.revision} item={result.data} charge={charge} /> : <LoadFeedback {...result} />}
  </div>;
}

function WorkDetailBody({ item, charge }: { item: Work; charge: (id: string) => void }) {
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  const [editing, setEditing] = useState(false);
  const link = { id: item.id, revision: item.revision };
  const appointment = item.industry === "beauty";
  const canEdit = !item.saleId && !["attended", "no-show", "delivered"].includes(item.state);
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
      <div className="inline-actions">
        {canEdit && <Button variant="secondary" disabled={editing || form.blocked} onClick={() => setEditing(true)}>
          {appointment ? "Reprogramar cita" : "Editar orden"}</Button>}
        {primary && <Button variant="secondary" disabled={editing || form.blocked || primary.blocked}
          onClick={() => void form.submit(() => ({ kind: "advance-work", workLink: link, workState: primary.state }), () => undefined)}>
          {primary.label}</Button>}
        {appointment && item.state === "scheduled" && item.day <= todayInBolivia() &&
          <Button variant="plain" disabled={editing || form.blocked}
            onClick={() => void form.submit(() => ({ kind: "advance-work", workLink: link, workState: "no-show" }), () => undefined)}>
            Registrar inasistencia</Button>}
        {item.industry === "repair" && <Button variant="secondary" disabled={editing || form.blocked}
          onClick={() => item.receiptId ? showDocument(item.receiptId) :
            void form.submit(() => ({ kind: "repair-receipt", workLink: link }), (result) => showDocument(result.entityId))}>
          {item.receiptId ? "Ver constancia de recepción" : "Emitir constancia de recepción"}</Button>}
        {!appointment && item.industry !== "repair" && <Button variant="secondary" disabled={editing || form.blocked}
          onClick={() => void form.submit(() => ({ kind: "work-receipt", workLink: link }), (result) => showDocument(result.entityId))}>
          Emitir constancia de trabajo
        </Button>}
        {item.saleId ? <Button onClick={() => showDocument(item.saleId!)}>Ver venta vinculada</Button> :
          canBillWork(item) && <Button disabled={editing || form.blocked} onClick={() => charge(item.id)}>Cobrar con una venta</Button>}
      </div>
      {primary?.hint && <p>{primary.hint}</p>}
      {form.error && <Alert tone="error">{form.error}</Alert>}
    </Card>
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
    case "working": return { state: "ready", label: "Marcar como listo" };
    case "ready": return { state: "delivered", label: "Confirmar entrega" };
  }
}
function approval(item: Work) {
  return { state: "approved", label: "Confirmar aprobación", blocked: item.budgetMinor == null,
    hint: item.budgetMinor == null ? "Guarda el presupuesto desde Editar orden." : undefined };
}
