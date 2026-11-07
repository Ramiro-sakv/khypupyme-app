import { useState } from "react";
import type { BusinessDocument } from "../../../shared/workspace/model";
import { useRecords } from "./context";
import { bob, localDate } from "./format";
import { Icon } from "./Icon";
import { Panel } from "./Panel";
import { Pager } from "./ui";
export default function Documents() {
  const page = useRecords<BusinessDocument>("documentsV2"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [generated, setGenerated] = useState<string[]>([]),
    [selected, setSelected] = useState<BusinessDocument | null>(null);
  async function exportDocument(document: BusinessDocument) {
    setBusy(document.id);
    setError("");
    try {
      const module = await import("./pdf");
      await module.saveDocument(document);
      setGenerated((old) =>
        old.includes(document.id) ? old : [...old, document.id],
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo generar el documento. Puedes reintentar sin repetir la operación.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">EL ARCHIVO DE TU NEGOCIO</span>
          <h2>Documentos</h2>
        </div>
        <span className="badge" data-state="neutral">
          No fiscales
        </span>
      </div>
      <p>
        Conservan los datos originales. Regenerar un PDF no vuelve a registrar
        la operación.
      </p>
      {error && <p role="alert">{error}</p>}
      <Pager page={page} />
      <div className="document-grid">
        {page.items.map((d) => (
          <article className="card document-card" key={d.id}>
            <span className="doc-icon">
              <Icon name="document" />
            </span>
            <h3>
              {d.number} · {d.title}
            </h3>
            <p>
              {d.businessName} · {localDate(d.date)}
            </p>
            <span className="badge" data-state="neutral">
              Documento emitido
            </span>
            {generated.includes(d.id) && (
              <p role="status">PDF generado en esta sesión</p>
            )}
            <button onClick={() => setSelected(d)}>
              Ver datos conservados
            </button>
            <button disabled={!!busy} onClick={() => void exportDocument(d)}>
              {busy === d.id ? "Preparando PDF…" : "Guardar / compartir PDF"}
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <Panel title={selected.number} onClose={() => setSelected(null)}>
          <span className="badge" data-state="neutral">
            Documento no fiscal
          </span>
          <h3>{selected.title}</h3>
          <p>
            {selected.businessName} · {localDate(selected.date)}
          </p>
          {selected.address && <p>{selected.address}</p>}
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Datos usados al emitir este documento
              </caption>
              <thead>
                <tr>
                  {selected.columns.map((column, index) => (
                    <th key={index}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl>
            {selected.totals.map((total, index) => (
              <div key={index}>
                <dt>{total.label}</dt>
                <dd>{bob(total.minor)}</dd>
              </div>
            ))}
          </dl>
          <p>{selected.notes}</p>
          {error && (
            <p role="alert" className="notice notice-error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={!!busy}
            onClick={() => void exportDocument(selected)}
          >
            {busy === selected.id
              ? "Preparando PDF…"
              : "Guardar / compartir este PDF"}
          </button>
          {generated.includes(selected.id) && (
            <p role="status">
              PDF generado. Confirma su ubicación o envío en el diálogo del
              dispositivo.
            </p>
          )}
          <p className="muted">
            La vista muestra el registro conservado. Generar el PDF no repite la
            operación comercial.
          </p>
        </Panel>
      )}
    </>
  );
}
