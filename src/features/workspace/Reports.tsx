import AuditHistory from "./AuditHistory";
import { useTimberTutorial } from "./tutorial/context";
import { useState } from "react";
import { ReportChart } from "../commerce/ReportChart";
import { useWorkspace } from "./context";
import { bob, today } from "./format";
import { Icon } from "./Icon";
import { ActionForm } from "./ui";
import { useReport } from "./useReport";
export default function Reports() {
  const tutorial = useTimberTutorial();
  const { run, busy } = useWorkspace(),
    [from, setFrom] = useState(
      tutorial?.active
        ? tutorial.state.session!.startedOn
        : today().slice(0, 7) + "-01",
    ),
    [to, setTo] = useState(today()),
    { report, error, refresh } = useReport(from, to);
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ENTIENDE CÓMO VA TU NEGOCIO</span>
          <h2>Informes y resultados</h2>
          <p className="muted">
            Consulta un periodo de hasta 366 días y genera tus documentos.
          </p>
        </div>
        <button onClick={refresh}>
          <Icon name="history" />
          Actualizar
        </button>
      </div>
      <div className="actions">
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Consultando resultados…</p>}
      {report && (
        <>
          {(report.pendingValuationCount > 0 ||
            report.unvaluedLossCount > 0) && (
            <p role="alert">
              Valoración incompleta: {report.pendingValuationCount} productos
              con costo pendiente y {report.unvaluedLossCount} salidas sin costo
              conocido.
            </p>
          )}
          <p>
            Margen bruto:{" "}
            {report.salesMinor
              ? (
                  ((report.salesMinor - report.costMinor) / report.salesMinor) *
                  100
                ).toFixed(2) + " %"
              : "Sin ventas netas"}
          </p>
          <div data-tutorial="reports" className="metric-grid">
            {[
              ["Ventas netas", report.salesMinor],
              ["Costo vendido neto", report.costMinor],
              ["Gastos operativos", report.expensesMinor],
              ["Pérdidas", report.lossesMinor],
              ["Resultado estimado", report.resultMinor],
              ["Valor del inventario actual", report.inventoryMinor],
              ["Fiados pendientes", report.pendingMinor],
              ["Compras de mercadería", report.purchasesMinor],
            ].map(([name, value]) => (
              <article className="card metric" key={name}>
                <span>{name}</span>
                <strong>{bob(Number(value))}</strong>
              </article>
            ))}
          </div>
          <ReportChart days={report.days} />
          <details className="card">
            <summary>Cómo se calcula el resultado</summary>
            <p>Ventas netas − costo de lo vendido − gastos operativos − pérdidas de inventario.</p>
            <p>Comprar mercadería aumenta el inventario. Si pagas en efectivo, disminuye el saldo de caja. El costo de la mercadería se reconoce en el resultado conforme se vende.</p>
            <p>Con Bs 40.000 vendidos, Bs 30.000 de costo vendido y Bs 10.000 de gastos operativos, el resultado es Bs 0 si no hubo pérdidas. Una compra de Bs 75.000 se muestra aparte.</p>
          </details>
          <div className="actions">
            <ActionForm
              disabled={busy}
              dataTutorial="result-report"
              label="Emitir informe de resultados PDF"
              onSave={() =>
                run({
                  kind: "report-document",
                  input: { from, to, inventory: false },
                })
              }
            >
              <p>Se conserva una copia de los datos al emitir.</p>
            </ActionForm>
            <ActionForm
              disabled={busy}
              dataTutorial="inventory-report"
              label="Emitir informe de inventario PDF"
              onSave={() =>
                run({
                  kind: "report-document",
                  input: { from, to, inventory: true },
                })
              }
            >
              <p>Inventario a la fecha actual.</p>
            </ActionForm>
          </div>
        </>
      )}
      <details><summary>Historial de correcciones protegidas</summary><AuditHistory /></details>
    </>
  );
}
