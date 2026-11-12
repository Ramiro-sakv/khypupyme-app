import { INDUSTRIES } from "../../../shared/business-industries";
import { ReportChart } from "../commerce/ReportChart";
import { industryHomes } from "./industryHome";
import { HomeAlertCard } from "./HomeAlertCard";
import { industryAppearance } from "./industryAppearance";
import { useCashState } from "./cash-context";
import { useWorkspace } from "./context";
import { bob, localDate, today } from "./format";
import GettingStarted from "./GettingStarted";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
import { useTimberTutorial } from "./tutorial/context";
import { useReport } from "./useReport";

export default function Dashboard() {
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  const tutorial = useTimberTutorial();
  const cash = useCashState();
  const date = today();
  const weekStart = new Date(Date.parse(date) - 6 * 86400000).toISOString().slice(0, 10);
  const { report, error, loading, refresh } = useReport(weekStart, date);
  const industry = business.industryId;
  const appearance = industryAppearance(industry);
  const home = industry ? industryHomes[industry] : undefined;
  const cashTitle = cash.loading || cash.error || cash.open ? "Ver caja" : "Abrir caja";
  const cashStatus = cash.loading ? "Consultando caja…" : cash.error ? cash.error : cash.open
    ? `Abierta desde ${localDate(cash.open.openedAt, true)} · ${bob(cash.open.balanceMinor)} en efectivo`
    : "Caja cerrada · prepara tu fondo si usarás efectivo";
  const needsPractice = industry === "timber" && !tutorial?.active &&
    (tutorial?.pendingControl || tutorial?.state.session?.status === "closing" ||
      (!tutorial?.state.completedAt && tutorial?.state.session?.status !== "completed"));
  return (
    <>
      <div className="day-workspace" data-layout={appearance.layout}>
        <section data-tutorial="dashboard" className="card day-start">
          <div className="day-identity">
            <span className="day-icon"><Icon name={appearance.icon} /></span>
            <div>
              <p>{localDate(date)}{industry && ` · ${INDUSTRIES[industry].name}`}</p>
              <h1>{business.name}</h1>
            </div>
          </div>
          <div className="day-cash">
            <span className="day-cash-state" data-open={!!cash.open} role={cash.error ? "alert" : "status"}>{cashStatus}</span>
            <button type="button" onClick={() => go("caja")}><Icon name="cash" /> {cashTitle}</button>
          </div>
          <div className="day-actions">
            {home ? home.shortcuts.map((action, index) =>
              <button key={action.title} className={index === 0 ? "primary" : ""} onClick={() => go(action.view, action.params)}>
                <Icon name={action.icon} /> {action.title}
              </button>) : <>
                <button className="primary" onClick={() => go("ventas")}><Icon name="sale" /> Vender</button>
                <button onClick={() => go("compras")}><Icon name="purchase" /> Registrar compra</button>
              </>}
          </div>
        </section>
        {!!home?.alerts.length && <section className="day-attention" aria-label="Qué revisar">
          {home.alerts.map((alert) => <HomeAlertCard key={alert.title} alert={alert} />)}
        </section>}
      </div>
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
