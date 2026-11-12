import type { WorkspaceQuery } from "../../../shared/workspace/model";
import { WORK_LABELS } from "../../../shared/workspace/operations";
import type { Appointment, WorkOrder } from "../../../shared/workspace/operations";
import { useRecords } from "./context";
import { localDate, today } from "./format";
import type { HomeAlert } from "./industryHome";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";

export function HomeAlertCard({ alert }: { alert: HomeAlert }) {
  const { go } = useWorkspaceNavigation();
  const expiresBefore = new Date(Date.parse(today() + "T12:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
  const filters: Partial<WorkspaceQuery> = "expiry" in alert.filters ? { expiresBefore }
    : { ...alert.filters, ...(alert.filters.reorder ? { active: true } : {}) };
  const records = useRecords<unknown>(alert.resource, filters);
  const appointments = alert.resource === "appointments";
  const orders = alert.resource === "workOrders";
  const previews = appointments
    ? [...records.items as Appointment[]].sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 3).map((row) => ({
      id: row.id, date: row.startAt.slice(11, 16), label: row.title, detail: row.customerName,
    }))
    : orders ? (records.items as WorkOrder[]).slice(0, 2).map((row) => ({
      id: row.id, date: localDate(row.dueOn), label: row.title, detail: WORK_LABELS[row.status],
    })) : [];
  const count = records.items.length;
  return (
    <article className="card day-alert">
      <header>
        <h2>{alert.title}</h2>
        {!records.loading && !records.error && <span className="day-alert-count" aria-label={count + (records.next ? " o más registros" : " registros")}>{count}{records.next ? "+" : ""}</span>}
      </header>
      {records.loading && <p role="status">Consultando…</p>}
      {records.error && <p className="notice notice-error" role="alert">{records.error} <button onClick={records.first}>Reintentar</button></p>}
      {!records.loading && !records.error && !count && <p className="muted">Sin registros por revisar.</p>}
      {!!previews.length && <ol className="day-alert-preview">
        {previews.map((row) => <li key={row.id}><span>{row.date}</span><strong>{row.label}</strong><small>{row.detail}</small></li>)}
      </ol>}
      <button className="text-button" onClick={() => go(alert.view, { atencion: alert.target })} aria-label={`Consultar: ${alert.title}`}>
        {appointments ? "Ver agenda" : orders ? "Ver órdenes" : "Consultar"} <Icon name="arrow" />
      </button>
    </article>
  );
}
