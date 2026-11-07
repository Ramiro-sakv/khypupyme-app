import { useState } from "react";
import { Link } from "react-router";
import type {
  Appointment,
  AppointmentStatus,
} from "../../../shared/workspace/operations";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { localDate, today } from "./format";
const labels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  attended: "Atendida",
  "no-show": "No asistió",
  cancelled: "Cancelada",
};
export default function AppointmentPage() {
  const [day, setDay] = useState(""),
    page = useRecords<Appointment>(
      "appointments",
      day ? { from: day, to: day } : {},
    ),
    { busy, run } = useWorkspace(),
    [selected, setSelected] = useState<Appointment | null | undefined>(),
    [client, setClient] = useState({ id: "", name: "" });
  return (
    <>
      <h2>Agenda de atención</h2>
      <p>
        Una agenda para tu negocio. Programar no cobra ni reserva productos.
      </p>
      <button
        className="primary"
        onClick={() => {
          setClient({ id: "", name: "" });
          setSelected(null);
        }}
      >
        Nueva cita
      </button>
      <label>
        Ver un día
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <button onClick={() => setDay("")}>Mostrar todas</button>
      <Pager page={page} />
      <div className="workflow-grid">
        {page.items.map((row) => (
          <article className="card" key={row.id}>
            <span className="badge">{labels[row.status]}</span>
            <h3>{row.title}</h3>
            <p>{row.customerName}</p>
            <p>
              {localDate(row.startAt, true)} — {localDate(row.endAt, true)}
            </p>
            {!row.saleId && !["cancelled", "no-show"].includes(row.status) && (
              <button
                onClick={() => {
                  setClient({ id: row.customerId, name: row.customerName });
                  setSelected(row);
                }}
              >
                Ver / actualizar
              </button>
            )}
            {row.status === "attended" && !row.saleId && (
              <Link
                className="button"
                to={"?vista=cobrar-trabajo&tipo=appointment&origen=" + row.id}
              >
                Preparar venta de esta atención
              </Link>
            )}
            {row.saleId && (
              <p className="notice">
                Venta confirmada vinculada. Consulta Ventas o Documentos.
              </p>
            )}
          </article>
        ))}
      </div>
      {selected !== undefined && (
        <Panel
          title={selected ? "Actualizar cita" : "Nueva cita"}
          onClose={() => setSelected(undefined)}
        >
          <ActionForm
            key={selected?.id ?? "new"}
            disabled={busy}
            label="Guardar cita"
            onSave={async (d) => {
              const result = await run({
                kind: "appointment",
                input: {
                  id: selected?.id ?? "",
                  expectedRevision: selected?.revision ?? 0,
                  customerId: client.id,
                  customerName: client.name,
                  title: String(d.get("title")),
                  startAt: String(d.get("start")) + ":00-04:00",
                  endAt: String(d.get("end")) + ":00-04:00",
                  status: String(d.get("status")) as AppointmentStatus,
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
              label="Servicio o motivo"
              value={selected?.title ?? ""}
              maxLength={100}
            />
            <Field
              name="start"
              type="datetime-local"
              label="Comienzo (hora de Bolivia)"
              value={selected?.startAt.slice(0, 16) ?? today() + "T09:00"}
            />
            <Field
              name="end"
              type="datetime-local"
              label="Fin"
              value={selected?.endAt.slice(0, 16) ?? today() + "T09:30"}
            />
            <label>
              Estado
              <select
                name="status"
                defaultValue={selected?.status ?? "scheduled"}
              >
                {(selected ? Object.keys(labels) : ["scheduled"]).map((k) => (
                  <option key={k} value={k}>
                    {labels[k as AppointmentStatus]}
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
