import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type {
  WorkOrder,
  WorkStatus,
} from "../../../shared/workspace/operations";
import { WORK_LABELS, WORK_PARTICULARS, workKindFor } from "../../../shared/workspace/operations";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { bob, cents, localDate, today } from "./format";
import { Icon } from "./Icon";
import { industryIcon } from "./industryAppearance";
import { useWorkspaceNavigation } from "./navigation";
function Events({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const events = useRecords<{
    id: string;
    kind: string;
    revision: number;
    createdAt: string;
    authorUid: string;
  }>("workflowEvents", { recordId: id }, open);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Historial de cambios</summary>
      <Pager page={events} />
      {events.items.map((e) => (
        <p key={e.id}>
          Revisión {e.revision} · {localDate(e.createdAt, true)} ·{" "}
          {e.kind === "operational-sale"
            ? "Venta vinculada"
            : "Cambio de orden"}
        </p>
      ))}
    </details>
  );
}
const transitions: Record<WorkStatus, WorkStatus[]> = {
  received: ["received", "diagnosis", "quoted", "approved", "cancelled"],
  diagnosis: ["diagnosis", "quoted", "cancelled"],
  quoted: ["quoted", "approved", "cancelled"],
  approved: ["approved", "in-progress", "cancelled"],
  "in-progress": ["in-progress", "ready", "cancelled"],
  "waiting-parts": ["waiting-parts", "in-progress", "cancelled"],
  ready: ["ready", "delivered", "cancelled"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};
const workPresentation = {
  cutting: { title: "Órdenes de corte", action: "Nueva orden", focus: undefined },
  cleaning: { title: "Trabajos de limpieza", action: "Nueva orden de limpieza", focus: undefined },
  professional: { title: "Trabajos y entregables", action: "Nuevo trabajo", focus: "deliverables" },
  repair: { title: "Taller y reparaciones", action: "Recibir equipo", focus: "equipment" },
  craft: { title: "Encargos y entregas", action: "Registrar encargo", focus: "specifications" },
} as const;

export default function WorkOrderPage() {
  const [params] = useSearchParams();
  const { go } = useWorkspaceNavigation();
  const filter = params.get("atencion");
  const attention = filter === "today" || filter === "late" || filter === "ready" || filter === "waiting" ? filter : undefined;
  const page = useRecords<WorkOrder>("workOrders", attention ? { attention } : {}),
    { business, busy, run } = useWorkspace(),
    [selected, setSelected] = useState<WorkOrder | null | undefined>(() => params.get("accion") === "nueva" ? null : undefined),
    [client, setClient] = useState({ id: "", name: "" }),
    kind = workKindFor(business.industryId);
  if (!kind) return <p>Este rubro no utiliza órdenes de trabajo.</p>;
  const fields = WORK_PARTICULARS[kind];
  const presentation = workPresentation[kind];
  return (
    <>
      <header className="operation-heading">
        <span className="business-symbol"><Icon name={industryIcon(business.industryId)} /></span>
        <h2 data-tutorial="work-orders">{presentation.title}</h2>
      </header>
      <div className="actions workflow-tools">
        <button data-tutorial="new-order" className="primary" onClick={() => {
          setClient({ id: "", name: "" });
          setSelected(null);
        }}>{presentation.action}</button>
        <button aria-pressed={!attention} onClick={() => go("ordenes", {})}>Todas</button>
        {kind === "cleaning" && <button aria-pressed={attention === "today"} onClick={() => go("ordenes", { atencion: "today" })}>Hoy</button>}
        {kind === "repair" && <button aria-pressed={attention === "waiting"} onClick={() => go("ordenes", { atencion: "waiting" })}>En espera de repuesto</button>}
        <button aria-pressed={attention === "late"} onClick={() => go("ordenes", { atencion: "late" })}>Atrasadas</button>
        <button aria-pressed={attention === "ready"} onClick={() => go("ordenes", { atencion: "ready" })}>Listas para cobrar</button>
      </div>
      <Pager page={page} />
      <div className="workflow-timeline">
        {page.items.map((row) => (
          <article className="card timeline-record" key={row.id}>
            <div className="timeline-record-time"><small>Compromiso</small><strong>{localDate(row.dueOn)}</strong></div>
            <div>
            <span className="badge">{WORK_LABELS[row.status]}</span>
            <h3>{row.title}</h3>
            <p>{row.customerName} · {bob(row.budgetMinor)} de presupuesto</p>
            {kind === "cleaning" && row.address && <p>{row.address}</p>}
            {presentation.focus && row.particulars?.[presentation.focus] && <p>{row.particulars[presentation.focus]}</p>}
            <details className="workflow-detail">
              <summary>Detalles del trabajo</summary>
              <p>{row.description}</p>
              {kind !== "cleaning" && row.address && <p>{row.address}</p>}
              <dl>{Object.entries(fields).map(([key, label]) => {
                const value = row.particulars?.[key as keyof NonNullable<WorkOrder["particulars"]>];
                return value ? <div key={key}><dt>{label}</dt><dd>{value}</dd></div> : null;
              })}</dl>
              {!!row.checks.length && <ul>{row.checks.map((task, index) => <li key={index}>{task}</li>)}</ul>}
            </details>
            {!row.saleId &&
              !["delivered", "cancelled"].includes(row.status) && (
                <button
                  onClick={() => {
                    setClient({ id: row.customerId, name: row.customerName });
                    setSelected(row);
                  }}
                >
                  Ver / actualizar
                </button>
              )}
            {!row.saleId && ["ready", "delivered"].includes(row.status) && (
              <Link
                className="button"
                to={"?vista=cobrar-trabajo&tipo=work-order&origen=" + row.id}
              >
                Preparar venta de este trabajo
              </Link>
            )}
            {row.saleId && (
              <p className="notice">Venta confirmada vinculada.</p>
            )}
            {kind !== "cutting" && <div className="actions">
              {row.saleId && row.status === "ready" && <button disabled={busy} onClick={() => {
                const { revision, saleId: _sale, updatedAt: _update, createdAt: _creation, ...input } = row;
                void _sale; void _update; void _creation;
                void run({ kind: "work-order", input: { ...input, expectedRevision: revision, status: "delivered" } }).catch(() => {});
              }}>Marcar entregada</button>}
              <button disabled={busy} onClick={() => void run({ kind: "operational-document", input: { sourceId: row.id, sourceKind: "work-order" } }).catch(() => {})}>
                {kind === "repair" ? "Emitir constancia de recepción" : "Emitir constancia de trabajo"}
              </button>
            </div>}
            <Events id={row.id} />
            </div>
          </article>
        ))}
      </div>
      {selected !== undefined && (
        <Panel
          title={selected ? "Actualizar orden" : presentation.action}
          onClose={() => setSelected(undefined)}
        >
          <ActionForm
            key={selected?.id ?? "new"}
            disabled={busy}
            label="Guardar orden"
            onSave={async (d) => {
              const result = await run({
                kind: "work-order",
                input: {
                  id: selected?.id ?? "",
                  expectedRevision: selected?.revision ?? 0,
                  kind,
                  ...(Object.keys(fields).length ? { particulars: Object.fromEntries(Object.keys(fields).map((key) => [key, String(d.get(key) ?? "")])) } : {}),
                  customerId: client.id,
                  customerName: client.name,
                  title: String(d.get("title")),
                  description: String(d.get("description")),
                  address: String(d.get("address")),
                  dueOn: String(d.get("due")),
                  checks: String(d.get("checks"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  budgetMinor: cents(d.get("budget")),
                  status: String(d.get("status")) as WorkStatus,
                },
              });
              if (result) setSelected(undefined);
            }}
          >
            <CustomerSelector
              required
              value={client.id}
              onChange={(id, name) => setClient({ id, name })}
            />
            <Field
              name="title"
              label="Nombre del trabajo o equipo"
              value={selected?.title ?? ""}
              maxLength={100}
            />
            <Field
              name="description"
              label={
                kind === "repair"
                  ? "Equipo, identificación y falla declarada"
                  : "Especificaciones y alcance acordado"
              }
              value={selected?.description ?? ""}
              maxLength={500}
            />
            {Object.entries(fields).map(([key, label]) => <Field key={key} name={key} label={label} value={selected?.particulars?.[key as keyof NonNullable<WorkOrder["particulars"]>] ?? ""} maxLength={500} required={false} />)}
            <Field
              name="address"
              label="Dirección o lugar"
              value={selected?.address ?? ""}
              maxLength={160}
              required={false}
            />
            <Field
              name="due"
              type="date"
              label="Fecha comprometida"
              value={selected?.dueOn ?? today()}
            />
            <Field
              name="budget"
              label="Presupuesto acordado BOB (no es un cobro)"
              value={((selected?.budgetMinor ?? 0) / 100).toFixed(2)}
            />
            <label>
              Tareas, materiales previstos o entregables (una línea por
              elemento)
              <textarea
                name="checks"
                defaultValue={selected?.checks.join("\n") ?? ""}
                maxLength={2400}
              />
            </label>
            <label>
              Estado
              <select
                name="status"
                defaultValue={selected?.status ?? "received"}
              >
                {(selected
                  ? [...transitions[selected.status], ...(kind === "repair" && selected.status === "in-progress" ? ["waiting-parts" as const] : [])]
                  : (["received"] as WorkStatus[])
                ).map((k) => (
                  <option key={k} value={k}>
                    {WORK_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
