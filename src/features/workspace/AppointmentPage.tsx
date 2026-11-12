import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type {
  Appointment,
  AppointmentStatus,
} from "../../../shared/workspace/operations";
import type { Item } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import { localDate, today } from "./format";
import { Icon } from "./Icon";
const labels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  attended: "Atendida",
  "no-show": "No asistió",
  cancelled: "Cancelada",
};
export default function AppointmentPage() {
  const [params] = useSearchParams();
  const [day, setDay] = useState(() => params.get("atencion") === "today" ? today() : ""),
    page = useRecords<Appointment>(
      "appointments",
      day ? { from: day, to: day } : {},
    ),
    { busy, run } = useWorkspace(),
    [selected, setSelected] = useState<Appointment | null | undefined>(() => params.get("accion") === "nueva" ? null : undefined),
    [client, setClient] = useState({ id: "", name: "" });
  const services = useRecords<Item>("items", { active: true, itemKind: "service" }, selected !== undefined);
  const [serviceId, setService] = useState("");
  const [start, setStart] = useState(today() + "T09:00"), [end, setEnd] = useState(today() + "T09:30");
  function select(row: Appointment | null) {
    setSelected(row);
    setClient(row ? { id: row.customerId, name: row.customerName } : { id: "", name: "" });
    setService(row?.serviceId ?? "");
    setStart(row?.startAt.slice(0, 16) ?? today() + "T09:00");
    setEnd(row?.endAt.slice(0, 16) ?? today() + "T09:30");
  }
  const service = services.items.find((item) => item.id === serviceId);
  function schedule(value: string, duration: string | undefined) {
    setStart(value);
    const time = Date.parse(value + ":00Z");
    if (duration && Number.isFinite(time)) setEnd(new Date(time + Number(duration) * 60000).toISOString().slice(0, 16));
  }
  return (
    <>
      <header className="operation-heading">
        <span className="business-symbol"><Icon name="calendar" /></span>
        <h2>Agenda de atención</h2>
      </header>
      <div className="actions workflow-tools">
        <button className="primary" onClick={() => select(null)}>Nueva cita</button>
        <Link className="button" to="?vista=ventas">Atender sin cita</Link>
        <button aria-pressed={day === today()} onClick={() => setDay(today())}>Hoy</button>
        <button aria-pressed={!day} onClick={() => setDay("")}>Mostrar todas</button>
        <label>Ver un día<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
      </div>
      <Pager page={page} />
      <div className="workflow-timeline">
        {[...page.items].sort((a, b) => a.startAt.localeCompare(b.startAt)).map((row) => (
          <article className="card timeline-record" key={row.id}>
            <div className="timeline-record-time">
              <strong>{row.startAt.slice(11, 16)}–{row.endAt.slice(11, 16)}</strong>
              <small>{localDate(row.startAt.slice(0, 10))}</small>
              <small>{Math.round((Date.parse(row.endAt) - Date.parse(row.startAt)) / 60000)} min</small>
            </div>
            <div>
              <span className="badge">{labels[row.status]}</span>
              <h3>{row.title}</h3>
              <p>{row.customerName}</p>
            {!row.saleId && !["cancelled", "no-show"].includes(row.status) && (
              <button
                onClick={() => {
                  select(row);
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
            </div>
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
                  title: service?.name ?? (serviceId && selected?.title ? selected.title : String(d.get("title"))),
                  ...(serviceId ? { serviceId } : {}),
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
            <label>Servicio del catálogo<select value={serviceId} onChange={(e) => {
              setService(e.target.value);
              schedule(start, services.items.find((item) => item.id === e.target.value)?.details?.profile?.durationMinutes);
            }}>
              <option value="">Escribir el motivo manualmente</option>
              {serviceId && !service && <option value={serviceId}>{selected?.title ?? "Servicio elegido"}</option>}
              {services.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <Pager page={services} />
            {!serviceId && <Field
              name="title"
              label="Servicio o motivo"
              value={selected?.title ?? ""}
              maxLength={100}
            />}
            <Field
              name="start"
              type="datetime-local"
              label="Comienzo (hora de Bolivia)"
              value={start} onValueChange={(value) => schedule(value, service?.details?.profile?.durationMinutes)}
            />
            <Field
              name="end"
              type="datetime-local"
              label="Fin"
              value={end} onValueChange={setEnd}
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
