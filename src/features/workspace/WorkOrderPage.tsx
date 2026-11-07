import { useState } from "react";
import { Link } from "react-router";
import type {
  WorkOrder,
  WorkStatus,
} from "../../../shared/workspace/operations";
import { WORK_LABELS, workKindFor } from "../../../shared/workspace/operations";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { bob, cents, localDate, today } from "./format";
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
  ready: ["ready", "delivered", "cancelled"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};
export default function WorkOrderPage() {
  const page = useRecords<WorkOrder>("workOrders"),
    { business, busy, run } = useWorkspace(),
    [selected, setSelected] = useState<WorkOrder | null | undefined>(),
    [client, setClient] = useState({ id: "", name: "" }),
    kind = workKindFor(business.industryId);
  if (!kind) return <p>Este rubro no utiliza órdenes de trabajo.</p>;
  return (
    <>
      <h2>Órdenes y trabajos</h2>
      <p>
        Recibe, presupuesta y registra avances. Solo la venta explícita mueve
        dinero y existencias.
      </p>
      <button
        className="primary"
        onClick={() => {
          setClient({ id: "", name: "" });
          setSelected(null);
        }}
      >
        Nueva orden
      </button>
      <Pager page={page} />
      <div className="workflow-grid">
        {page.items.map((row) => (
          <article className="card" key={row.id}>
            <span className="badge">{WORK_LABELS[row.status]}</span>
            <h3>{row.title}</h3>
            <p>
              {row.customerName} · compromiso {localDate(row.dueOn)}
            </p>
            <p>{row.description}</p>
            {row.address && <p>{row.address}</p>}
            <p>Presupuesto de referencia: {bob(row.budgetMinor)}</p>
            <ul>
              {row.checks.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
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
            <Events id={row.id} />
          </article>
        ))}
      </div>
      {selected !== undefined && (
        <Panel
          title={selected ? "Actualizar orden" : "Recibir trabajo"}
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
                  ? transitions[selected.status]
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
