import { useState } from "react";
import type { Delivery } from "../../../shared/workspace/operations";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { localDate, today } from "./format";
const labels: Record<Delivery["status"], string> = {
  pending: "Pendiente",
  prepared: "Preparada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
export default function DeliveryPage() {
  const page = useRecords<Delivery>("deliveries"),
    sales = useRecords<SaleV2>("salesV2"),
    { busy, run } = useWorkspace(),
    [selected, setSelected] = useState<Delivery | null | undefined>();
  return (
    <>
      <h2>Entregas</h2>
      <p>
        Seguimiento de una venta confirmada. Entregar no descuenta stock de
        nuevo; cancelar la entrega no anula la venta.
      </p>
      <button className="primary" onClick={() => setSelected(null)}>
        Programar entrega
      </button>
      <Pager page={page} />
      <div className="workflow-grid">
        {page.items.map((row) => (
          <article className="card" key={row.id}>
            <span className="badge">{labels[row.status]}</span>
            <h3>{row.address}</h3>
            <p>
              {localDate(row.scheduledOn)} · {row.reference}
            </p>
            {!["delivered", "cancelled"].includes(row.status) && (
              <button onClick={() => setSelected(row)}>Ver / actualizar</button>
            )}
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
                  address: String(d.get("address")),
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
                defaultValue={selected?.saleId ?? ""}
                required
              >
                {selected && (
                  <option value={selected.saleId}>Venta vinculada</option>
                )}
                {!selected && <option value="">Seleccionar venta</option>}
                {!selected &&
                  sales.items
                    .filter((s) => s.status === "active")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number} · {s.customerName}
                      </option>
                    ))}
              </select>
            </label>
            {!selected && <Pager page={sales} />}
            <Field
              name="address"
              label="Dirección de entrega"
              value={selected?.address ?? ""}
              maxLength={160}
            />
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
