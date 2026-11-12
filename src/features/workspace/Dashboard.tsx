import { INDUSTRIES } from "../../../shared/business-industries";
import { ReportChart } from "../commerce/ReportChart";
import { hasAgenda, hasDelivery, workKindFor } from "../../../shared/workspace/operations";
import { industryHomes } from "./industryHome";
import { useRecords } from "./context";
import type { WorkspaceQuery } from "../../../shared/workspace/model";
import { industryIcon } from "./industryAppearance";
import { useCashState } from "./cash-context";
import { useWorkspace } from "./context";
import { bob, localDate, today } from "./format";
import GettingStarted from "./GettingStarted";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
import { useTimberTutorial } from "./tutorial/context";
import { useReport } from "./useReport";

function IndustryAlert({ alert }: { alert: NonNullable<(typeof industryHomes)[keyof typeof industryHomes]>["alerts"][number] }) {
  const { go } = useWorkspaceNavigation();
  const expiresBefore = new Date(Date.parse(today() + "T12:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
  const filters: Partial<WorkspaceQuery> = "expiry" in alert.filters ? { expiresBefore }
    : { ...alert.filters, ...(alert.filters.reorder ? { active: true } : {}) };
  const records = useRecords(alert.resource, filters);
  const label = records.loading ? "Consultando…" : records.error ? "Revisar consulta"
    : records.items.length ? `${records.items.length}${records.next ? "+" : ""}` : "0";
  return <button onClick={() => go(alert.view, { atencion: alert.target })}>
    {alert.title} <span className="badge">{label}</span>
  </button>;
}

export default function Dashboard() {
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  const tutorial = useTimberTutorial();
  const cash = useCashState();
  const date = today();
  const weekStart = new Date(Date.parse(date) - 6 * 86400000).toISOString().slice(0, 10);
  const { report, error, loading, refresh } = useReport(weekStart, date);
  const industry = business.industryId;
  const services = industry && INDUSTRIES[industry].profile === "services";
  const home = industry ? industryHomes[industry] : undefined;
  const cashTitle = cash.loading || cash.error || cash.open ? "Ver caja" : "Abrir caja";
  const cashStatus = cash.loading ? "Consultando caja…" : cash.error ? cash.error : cash.open
    ? `Abierta desde ${localDate(cash.open.openedAt, true)} · ${bob(cash.open.balanceMinor)} en efectivo`
    : "Caja cerrada · prepara tu fondo si usarás efectivo";
  const needsPractice = industry === "timber" && !tutorial?.active &&
    (tutorial?.pendingControl || tutorial?.state.session?.status === "closing" ||
      (!tutorial?.state.completedAt && tutorial?.state.session?.status !== "completed"));
  const attention = [
    ...(industry === "timber" ? [{ title: "Stock por largo, espesor y ancho", view: "inventario" }] : []),
    ...(industry === "convenience" ? [
      { title: "Reponer productos", view: "inventario", filter: "reposicion" },
      { title: "Próximos vencimientos", view: "inventario", filter: "vencimientos" },
    ] : []),
    ...(industry === "clothing" ? [
      { title: "Stock por talla y color", view: "inventario", filter: "variantes" },
      { title: "Buscar venta para un cambio", view: "ventas", filter: "cambios" },
    ] : []),
    ...(industry === "appliances" ? [
      { title: "Garantías e historial por serie", view: "garantias" },
      { title: "Equipos en inspección", view: "garantias", filter: "inspeccion" },
    ] : []),
    ...(hasAgenda(industry) ? [{ title: "Consultar agenda", view: "agenda" }] : []),
    ...(workKindFor(industry) ? [{ title: "Consultar órdenes", view: "ordenes" }] : []),
    ...(hasDelivery(industry) ? [{ title: "Revisar entregas", view: "entregas" }] : []),
    ...(industry === "beverages" ? [{ title: "Envases por cliente", view: "envases" }] : []),
  ];
  return (
    <>
      <section data-tutorial="dashboard" className="card day-start">
        <div className="day-identity">
          <span className="day-icon"><Icon name={industryIcon(industry)} /></span>
          <div>
            <p>{localDate(date)}</p>
            <h2>{business.name}</h2>
          </div>
        </div>
        <div className="day-actions">
          <div className="day-cash">
            <span className="day-cash-state" data-open={!!cash.open} role={cash.error ? "alert" : "status"}>{cashStatus}</span>
            <button type="button" onClick={() => go("caja")}><Icon name="cash" /> {cashTitle}</button>
          </div>
          {home ? home.shortcuts.map((action, index) =>
            <button key={action.title} className={index === 0 ? "primary" : ""} onClick={() => go(action.view, action.params)}>
              <Icon name={action.icon} /> {action.title}
            </button>) : <>
              <button className="primary" onClick={() => go("ventas")}><Icon name="sale" /> Vender</button>
              {!services && <button onClick={() => go("compras")}><Icon name="purchase" /> Registrar compra</button>}
            </>}
        </div>
      </section>
      {home && home.alerts.length > 0 && <section className="card day-attention">
        <h3>Qué revisar</h3>
        <div className="day-attention-links">{home.alerts.map((alert) => <IndustryAlert key={alert.title} alert={alert} />)}</div>
      </section>}
      {!home && attention.length > 0 && (
        <section className="card day-attention">
          <h3>Qué revisar</h3>
          <div className="day-attention-links">
            {attention.map(({ title, view, filter }) => (
              <button key={title} onClick={() => go(view, filter ? { atencion: filter } : undefined)}>{title} <Icon name="arrow" /></button>
            ))}
          </div>
        </section>
      )}
      <section className="card day-summary">
        <div className="section-heading">
          <h3>Últimos siete días</h3>
          <button className="text-button" onClick={() => go("informes")}>Ver informes <Icon name="arrow" /></button>
        </div>
        {loading && <p role="status">Consultando cifras de la semana…</p>}
        {error && <div className="notice notice-error" role="alert">{error} <button onClick={refresh}>Volver a consultar</button></div>}
        {report && (
          <>
            <dl className="day-totals">
              <div><dt>Ventas netas</dt><dd>{bob(report.salesMinor)}</dd></div>
              <div><dt>Compras</dt><dd>{bob(report.purchasesMinor)}</dd></div>
              <div><dt>Gastos netos</dt><dd>{bob(report.expensesMinor)}</dd></div>
              <div><dt>Resultado estimado</dt><dd>{bob(report.resultMinor)}</dd></div>
            </dl>
            <ReportChart days={report.days} compact />
            {report.pendingMinor > 0 && <button className="text-button" onClick={() => go("fiados")}>Fiados pendientes · {bob(report.pendingMinor)}</button>}
            {(report.pendingValuationCount > 0 || report.unvaluedLossCount > 0) && (
              <div className="notice notice-warning" role="status">
                Hay costos por completar. El resultado puede estar incompleto.
                <button onClick={() => go(business.legacy ? "anteriores" : "inventario")}>Revisar valoración</button>
              </div>
            )}
          </>
        )}
      </section>
      {needsPractice && (
        <section className="card day-guide">
          <div><h3>Práctica de madera</h3><p className="muted">Abre caja y practica con datos ficticios.</p></div>
          <button onClick={() => go("guia")}>{tutorial?.state.session?.status === "paused" || tutorial?.state.session?.status === "active" ? "Reanudar práctica" : "Abrir guía"}</button>
        </section>
      )}
      {industry !== "timber" && <GettingStarted compact />}
    </>
  );
}
