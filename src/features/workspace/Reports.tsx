import { useEffect, useState } from "react";
import type {
  BusinessDocument,
  WorkspaceReport,
} from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Pager } from "./ui";
import { bob, today } from "./format";
import { ReportChart } from "../commerce/ReportChart";
export default function Reports() {
  const { business, repository, revision, run, busy } = useWorkspace(),
    [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today()),
    [result, setResult] = useState<{
      key: string;
      report: WorkspaceReport | null;
      error: string;
    } | null>(null);
  const key = JSON.stringify([business.id, revision, from, to]),
    current = result?.key === key ? result : null,
    report = current?.report,
    error = current?.error;
  useEffect(() => {
    let active = true;
    repository
      .report(business.id, from, to)
      .then((r) => {
        if (active) setResult({ key, report: r, error: "" });
      })
      .catch((e) => {
        if (active)
          setResult({
            key,
            report: null,
            error: e instanceof Error ? e.message : "No se pudo cargar.",
          });
      });
    return () => {
      active = false;
    };
  }, [business.id, repository, from, to, key]);
  return (
    <>
      <h2>Tus números</h2>
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
          <div className="workspace-grid">
            {[
              ["Ventas netas", report.salesMinor],
              ["Costo vendido neto", report.costMinor],
              ["Gastos operativos", report.expensesMinor],
              ["Pérdidas", report.lossesMinor],
              ["Resultado estimado", report.resultMinor],
              ["Valor del inventario actual", report.inventoryMinor],
              ["Fiados pendientes", report.pendingMinor],
              ["Compras pagadas", report.purchasesMinor],
            ].map(([name, value]) => (
              <article className="card metric" key={name}>
                <span>{name}</span>
                <strong>{bob(Number(value))}</strong>
              </article>
            ))}
          </div>
          <p>
            No representa saldo bancario. Las compras pagadas no son gastos
            operativos; el costo se reconoce al vender.
          </p>
          <ReportChart days={report.days} />
          <details>
            <summary>Tabla de resultados diarios</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ventas netas</th>
                    <th>Gastos netos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{bob(d.salesMinor)}</td>
                      <td>{bob(d.expensesMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="actions">
            <ActionForm
              disabled={busy}
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
    </>
  );
}
export function Documents() {
  const page = useRecords<BusinessDocument>("documentsV2"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  return (
    <>
      <h2>Documentos no fiscales</h2>
      <p>
        Conservan los datos originales. Regenerar un PDF no vuelve a registrar
        la operación.
      </p>
      {error && <p role="alert">{error}</p>}
      <Pager page={page} />
      {page.items.map((d) => (
        <article className="card" key={d.id}>
          <h3>
            {d.number} · {d.title}
          </h3>
          <p>
            {d.businessName} · {d.date}
          </p>
          <button
            disabled={!!busy}
            onClick={() => {
              setBusy(d.id);
              setError("");
              void import("./pdf")
                .then((m) => m.saveDocument(d))
                .catch((e) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo generar. Puedes reintentar este documento.",
                  ),
                )
                .finally(() => setBusy(""));
            }}
          >
            {busy === d.id ? "Preparando PDF…" : "Guardar / compartir PDF"}
          </button>
        </article>
      ))}
    </>
  );
}
