import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import type { Delivery } from "../../../shared/workspace/operations";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { Icon } from "./Icon";
import { bob, statusLabel, localDate, today } from "./format";
const labels: Record<Delivery["status"], string> = {
  pending: "Pendiente",
  prepared: "Preparada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
export default function DeliveryPage() {
  const [params] = useSearchParams();
  const saleId = params.get("venta") ?? "";
  const late = params.get("atencion") === "late";
  const linkedSale = useRecords<SaleV2>("salesV2", saleId ? { id: saleId } : {}, !!saleId);
  const page = useRecords<Delivery>("deliveries", late ? { attention: "late" } : {}),
    sales = useRecords<SaleV2>("salesV2"),
    { busy, run, business } = useWorkspace(),
    [selected, setSelected] = useState<Delivery | null | undefined>(() => saleId ? null : undefined);
  const special = business.industryId !== "timber";
  const [mode, setMode] = useState<"pickup" | "delivery">("delivery");
  return (
    <>
      <header className="operation-heading">
        <span className="business-symbol"><Icon name="box" /></span>
        <h2 data-tutorial="deliveries">Entregas</h2>
      </header>
      <p>
        Seguimiento de una venta confirmada. Entregar no descuenta stock de
        nuevo; cancelar la entrega no anula la venta.
      </p>
      <button
        data-tutorial="new-delivery"
        className="primary"
        onClick={() => { setSelected(null); setMode("delivery"); }}
      >
        Programar entrega
      </button>
      {late && <Link to="?vista=entregas">Mostrar todas las entregas</Link>}
      <Pager page={page} />
      <div className="workflow-timeline">
        {page.items.map((row) => (
          <article className="card timeline-record" key={row.id}>
            <div className="timeline-record-time"><small>Programada</small><strong>{localDate(row.scheduledOn)}</strong></div>
            <div>
            <span className="badge">{labels[row.status]}</span>
            <h3>{row.mode === "pickup" ? "Retiro en el negocio" : row.address}</h3>
            {row.reference && <p>{row.reference}</p>}
            {!["delivered", "cancelled"].includes(row.status) && (
              <button onClick={() => { setSelected(row); setMode(row.mode ?? "delivery"); }}>Ver / actualizar</button>
            )}
            {special && <button disabled={busy} onClick={() => void run({ kind: "operational-document", input: { sourceId: row.id, sourceKind: "delivery" } }).catch(() => {})}>Emitir constancia de despacho</button>}
            </div>
          </article>
        ))}
      </div>
      {selected !== undefined && (
        <Panel title="Entrega de venta" onClose={() => setSelected(undefined)}>
          <ActionForm
            key={selected?.id ?? "new"}
            disabled={busy}
            label="Guardar entrega"
            onSave={async (d) => {
              const result = await run({
                kind: "delivery",
                input: {
                  id: selected?.id ?? "",
                  expectedRevision: selected?.revision ?? 0,
                  saleId: String(d.get("sale")),
                  address: String(d.get("address") ?? ""),
                  ...(special ? { mode } : {}),
                  scheduledOn: String(d.get("day")),
                  reference: String(d.get("reference")),
                  status: String(d.get("status")) as Delivery["status"],
                },
              });
              if (result) setSelected(undefined);
            }}
          >
            <label>
              Venta de esta página
              <select
                name="sale"
                defaultValue={selected?.saleId ?? (linkedSale.items[0]?.status === "active" ? saleId : "")}
                key={linkedSale.items[0]?.id ?? "manual"}
                required
              >
                {selected && (
                  <option value={selected.saleId}>Venta vinculada</option>
                )}
                {!selected && <option value="">Seleccionar venta</option>}
                {!selected && linkedSale.items[0]?.status === "active" && <option value={saleId}>{linkedSale.items[0].number} · {linkedSale.items[0].customerName}</option>}
                {!selected &&
                  sales.items
                    .filter((s) => s.status === "active" && s.id !== linkedSale.items[0]?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number} · {s.customerName} · {bob(s.totalMinor)} ·{" "}
                        {statusLabel(s.method)}
                      </option>
                    ))}
              </select>
            </label>
            {!selected && <Pager page={sales} />}
            {special && <label>Modalidad<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="delivery">Entrega a domicilio</option><option value="pickup">Retiro en el negocio</option>
            </select></label>}
            {mode === "delivery" && <Field
              name="address"
              label="Dirección de entrega"
              value={selected?.address ?? ""}
              maxLength={160}
            />}
            <Field
              name="day"
              label="Fecha programada"
              type="date"
              value={selected?.scheduledOn ?? today()}
            />
            <Field
              name="reference"
              label="Referencia o instrucciones"
              required={false}
              value={selected?.reference ?? ""}
              maxLength={120}
            />
            <label>
              Estado
              <select
                name="status"
                defaultValue={selected?.status ?? "pending"}
              >
                {(selected
                  ? selected.status === "pending"
                    ? ["pending", "prepared", "cancelled"]
                    : ["prepared", "delivered", "cancelled"]
                  : ["pending"]
                ).map((k) => (
                  <option key={k} value={k}>
                    {labels[k as Delivery["status"]]}
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
