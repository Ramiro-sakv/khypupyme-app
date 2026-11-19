import { useState } from "react";
import type { components } from "../api/schema";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { CommerceHeading, LoadFeedback, OperationForm, Pages, SearchForm, useCommercialForm } from "../commerce/CommerceUi";
import { dateLabel } from "../commerce/models";
import type { EntryDocument, Page } from "../commerce/models";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";

type Delivery = components["schemas"]["DeliveryInfo"];
const modeLabel = (mode: string) => mode === "pickup" ? "Retiro" : "Entrega";
const statusLabel = (row: Delivery) => row.cancelledOn ? "Cancelada" : row.completedOn ? "Completada" : row.preparedOn ? "Preparada" : "Programada";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" }).format(new Date());

const deliveryFilters = { pending: "Pendientes", today: "Para hoy", overdue: "Atrasadas", prepared: "Preparadas",
  completed: "Completadas", cancelled: "Canceladas" };

export function DeliveriesPage({ initial }: { initial?: string }) {
  const { showDocument } = useCommerce();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(initial && Object.hasOwn(deliveryFilters, initial) ? initial : "");
  const [mode, setMode] = useState("");
  const [search, setSearch] = useState("");
  const result = useCommerceData<Page<Delivery>>("/deliveries?" + new URLSearchParams({ page: String(page), filter, mode, search }));
  return <div className="commerce-stack">
    <CommerceHeading title="Retiros y entregas" />
    <Card>
      <div className="inventory-controls">
        <SearchForm label="Buscar venta, cliente o dirección" onSearch={(value) => { setSearch(value); setPage(1); }} />
        <SelectField label="Estado del despacho" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="">Todos</option>
          {Object.entries(deliveryFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <SelectField label="Modalidad" value={mode} onChange={(event) => { setMode(event.target.value); setPage(1); }}>
          <option value="">Todas</option><option value="pickup">Retiro</option><option value="delivery">Entrega</option>
        </SelectField>
      </div>
      {result.data ? <DataTable caption="Retiros y entregas" columns={["Venta", "Cliente", "Modalidad", "Fecha", "Estado", "Acción"]}
        rows={result.data.items.map((row) => ({ id: row.saleId, cells: [row.number, row.customerName ?? "—", modeLabel(row.mode),
          <>{dateLabel(row.day)}{row.address && <small className="record-secondary">{row.address}</small>}</>,
          statusLabel(row), <Button variant="secondary" onClick={() => showDocument(row.saleId)}>Abrir venta</Button>] }))} />
        : <LoadFeedback {...result} />}
      {result.data?.items.length === 0 && <p>{filter || mode || search ? "No hay despachos que coincidan con estos filtros." : "Programa el retiro o la entrega desde una venta confirmada."}</p>}
      <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}

export function DeliveryPanel({ document }: { document: EntryDocument }) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const { readOnly, showDocument } = useCommerce();
  const form = useCommercialForm();
  const delivery = document.delivery;
  return <Card>
    <h2>Retiro o entrega</h2>
    {delivery && <p>{modeLabel(delivery.mode)} · {dateLabel(delivery.day)}{delivery.address && " · " + delivery.address}
      {" · " + statusLabel(delivery)}{delivery.completedOn && " el " + dateLabel(delivery.completedOn)}</p>}
    {!readOnly && delivery && !delivery.cancelledOn && <Button variant="plain" disabled={form.blocked || editing || cancelling}
      onClick={() => void form.submit(() => ({ kind: "delivery-receipt", sourceId: document.id }), (result) => showDocument(result.entityId))}>
      Emitir constancia de despacho
    </Button>}
    {!readOnly && !cancelling && !delivery?.cancelledOn && !delivery?.completedOn && <div className="inline-actions">
      <Button variant="secondary" disabled={editing} onClick={() => setEditing(true)}>
        {delivery ? "Reprogramar" : "Programar retiro o entrega"}
      </Button>
      {delivery && !editing && <Button disabled={form.blocked}
        onClick={() => void form.submit(() => ({ kind: "complete-delivery", sourceId: document.id }), () => undefined)}>
        {delivery.mode === "pickup" ? "Completar retiro" : "Completar entrega"}
      </Button>}
      {delivery && !editing && !delivery.preparedOn && <Button variant="secondary" disabled={form.blocked}
        onClick={() => void form.submit(() => ({ kind: "prepare-delivery", sourceId: document.id }), () => undefined)}>Marcar preparada</Button>}
      {delivery && !editing && <Button variant="plain" disabled={form.blocked} onClick={() => setCancelling(true)}>Cancelar entrega</Button>}
    </div>}
    {form.error && <Alert tone="error">{form.error}</Alert>}
    {editing && <DeliveryEditor document={document} close={() => setEditing(false)} />}
    {cancelling && <OperationForm title="Cancelar entrega" action="Confirmar cancelación"
      error={form.error} blocked={form.blocked} onClose={() => setCancelling(false)} onSubmit={(event) => {
        event.preventDefault();
        void form.submit(() => ({ kind: "cancel-delivery", sourceId: document.id, note }), () => setCancelling(false));
      }}>
      <p>La venta y su movimiento de existencias siguen confirmados.</p>
      <TextField label="Motivo de cancelación" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
    </OperationForm>}
  </Card>;
}

function DeliveryEditor({ document, close }: { document: EntryDocument; close: () => void }) {
  const [mode, setMode] = useState(document.delivery?.mode ?? "pickup");
  const [day, setDay] = useState(document.delivery?.day ?? today);
  const [address, setAddress] = useState(document.delivery?.address ?? "");
  const form = useCommercialForm();
  return <OperationForm title="Programación" action="Guardar programación" error={form.error} blocked={form.blocked}
    onClose={close} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "schedule-delivery", sourceId: document.id, delivery: { mode, day,
        address: mode === "delivery" ? address : undefined } }), close);
    }}>
    <SelectField label="Modalidad" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="pickup">Retiro en tienda</option><option value="delivery">Entrega a domicilio</option>
    </SelectField>
    <TextField label="Fecha programada" type="date" value={day} min={today()} required onChange={(event) => setDay(event.target.value)} />
    {mode === "delivery" && <TextField label="Dirección de entrega" required maxLength={240} value={address}
      onChange={(event) => setAddress(event.target.value)} />}
  </OperationForm>;
}
