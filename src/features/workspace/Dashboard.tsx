import { useState } from "react";
import type { CashSession } from "../../../shared/workspace/model";
import { ReportChart } from "../commerce/ReportChart";
import GettingStarted from "./GettingStarted";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { useRecords, useWorkspace } from "./context";
import { bob, localDate, today } from "./format";
import { useWorkspaceNavigation } from "./navigation";
import { useReport } from "./useReport";
export default function Dashboard() {
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    [period] = useState(() => ({
      from: today().slice(0, 7) + "-01",
      to: today(),
    })),
    { report, error, loading, refresh } = useReport(period.from, period.to),
    cash = useRecords<CashSession>("cashSessions", { status: "open" }),
    open = cash.items[0];
  const metrics = report
    ? ([
        {
          label: "Ventas netas",
          value: report.salesMinor,
          icon: "sale",
          hint: "Durante el periodo",
        },
        {
          label: "Resultado estimado",
          value: report.resultMinor,
          icon: "chart",
          hint: "Después de costos, gastos y pérdidas",
        },
        {
          label: "Valor del inventario",
          value: report.inventoryMinor,
          icon: "box",
          hint: "Valor conocido a la fecha actual",
        },
        {
          label: "Fiados pendientes",
          value: report.pendingMinor,
          icon: "debt",
          hint: "Saldo de todos los periodos",
        },
      ] as { label: string; value: number; icon: IconName; hint: string }[])
    : [];
  return (
    <>
      <div className="notice">
        <strong>Tu negocio tiene su propia forma de trabajar.</strong>
        <button onClick={() => go("guia")}>
          Abrir guía y herramientas del rubro
        </button>
      </div>
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">VAMOS PASO A PASO</span>
          <h2>Una mirada a tu negocio</h2>
          <p>Las operaciones, el inventario y tus números en un solo lugar.</p>
          <span className="period-chip">
            <Icon name="history" />
            {localDate(period.from)} — {localDate(period.to)}
          </span>
        </div>
        <button className="primary" onClick={() => go("ventas")}>
          <Icon name="plus" />
          Registrar venta
        </button>
      </section>
      {loading && (
        <div
          className="metric-grid"
          role="status"
          aria-label="Cargando resumen"
        >
          {[1, 2, 3, 4].map((n) => (
            <div className="card skeleton" key={n}>
              <span />
              <strong />
              <small />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          <span>{error}</span>
          <button onClick={refresh}>Volver a consultar</button>
        </div>
      )}
      <div className="metric-grid">
        {metrics.map((m) => (
          <article className="card metric" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className="metric-icon">
                <Icon name={m.icon} />
              </span>
            </div>
            <strong className={m.value < 0 ? "negative" : ""}>
              {bob(m.value)}
            </strong>
            <small>{m.hint}</small>
          </article>
        ))}
      </div>
      {report &&
        (report.pendingValuationCount > 0 || report.unvaluedLossCount > 0) && (
          <div className="notice notice-warning" role="status">
            <Icon name="shield" />
            <div>
              <strong>Hay costos por completar</strong>
              <p>
                {report.pendingValuationCount} productos y{" "}
                {report.unvaluedLossCount} salidas anteriores sin costo
                conocido. El resumen puede estar incompleto.
              </p>
              <button
                onClick={() =>
                  go(business.legacy ? "anteriores" : "inventario")
                }
              >
                Revisar valoración
              </button>
            </div>
          </div>
        )}
      <div className="dashboard-columns">
        <section className="card chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EVOLUCIÓN DEL PERIODO</span>
              <h3>Ventas y gastos</h3>
            </div>
            <button className="text-button" onClick={() => go("informes")}>
              Ver informes <Icon name="arrow" />
            </button>
          </div>
          {report ? (
            <ReportChart days={report.days} />
          ) : (
            <p className="muted">
              El gráfico aparecerá al consultar tus datos.
            </p>
          )}
        </section>
        <section className="card quick-panel">
          <span className="eyebrow">TU DÍA A DÍA</span>
          <h3>¿Qué vas a registrar?</h3>
          {(
            [
              {
                id: "ventas",
                label: "Nueva venta",
                hint: "Productos y servicios",
                icon: "sale",
              },
              {
                id: "compras",
                label: "Registrar compra",
                hint: "Entradas con costo",
                icon: "purchase",
              },
              {
                id: "caja",
                label: open ? "Revisar caja" : "Abrir caja",
                hint: cash.loading
                  ? "Consultando sesión…"
                  : cash.error
                    ? "Consulta el estado en Caja"
                    : open
                      ? "Caja abierta · " + bob(open.balanceMinor)
                      : "Prepara el fondo inicial",
                icon: "cash",
              },
              {
                id: "inventario",
                label: "Administrar inventario",
                hint: "Productos, unidades y movimientos",
                icon: "box",
              },
            ] as { id: string; label: string; hint: string; icon: IconName }[]
          ).map((a) => (
            <button
              className="quick-action"
              key={a.id}
              onClick={() => go(a.id)}
            >
              <span className="quick-icon">
                <Icon name={a.icon} />
              </span>
              <span>
                <strong>{a.label}</strong>
                <small>{a.hint}</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </section>
      </div>
      <GettingStarted
        cashOpen={!!open}
        cashLoading={cash.loading}
        cashError={cash.error}
      />
      <div className="notice notice-info">
        <Icon name="shield" />
        <p>
          El resultado es estimado con los costos registrados. Las compras
          pagadas no son gastos operativos; este resumen no representa un saldo
          bancario.
        </p>
      </div>
    </>
  );
}
