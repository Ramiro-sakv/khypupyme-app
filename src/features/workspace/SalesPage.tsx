import { useState } from "react";
import { useSearchParams } from "react-router";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, localDate, statusLabel } from "./format";
import { Pager } from "./ui";

import ReturnForm from "./ReturnForm";
import Trade from "./Trade";
import { useWorkspaceNavigation } from "./navigation";
export default function SalesPage() {
  const [params] = useSearchParams();
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  const changes = business.industryId === "clothing" && params.get("atencion") === "cambios";
  return (
    <>
      {changes ? <div className="actions"><button onClick={() => go("ventas", {})}>Volver a vender</button></div> : <Trade />}
      <SalesHistory changes={changes} />
    </>
  );
}
export function SalesHistory({ changes = false }: { changes?: boolean }) {
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  const [search, setSearch] = useState("");
  const page = useRecords<SaleV2>("salesV2", { ...(search.trim().length >= 2 ? { search: search.trim() } : {}) });
  const [selection, setSelection] = useState<{ sale: SaleV2; exchange: boolean } | null>(null);
  const apparel = business.industryId === "clothing";
  const actions = (sale: SaleV2) => (
    <div className="actions">
      {apparel && sale.status === "active" && sale.lines.some((line) => line.kind === "apparel") && (
        <button onClick={() => setSelection({ sale, exchange: true })}>Iniciar cambio</button>
      )}
      <button onClick={() => setSelection({ sale, exchange: false })}>Detalle y devolución</button>
    </div>
  );
  return (
    <>
      <h2 data-tutorial="sales-history">{changes ? "Buscar venta para un cambio" : "Ventas y devoluciones"}</h2>
      {apparel && <div className="catalog-toolbar">
        <label>Buscar en las ventas por comprobante o cliente (desde 2 caracteres)
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={40} />
        </label>
        {!changes && <button onClick={() => go("ventas", { atencion: "cambios" })}>Buscar un cambio</button>}
      </div>}
      <Pager page={page} />
      <div className="table-scroll desktop-records">
        <table>
          <thead>
            <tr>
              <th>Venta</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th className="numeric">Importe</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.number}</strong>
                  <small>{localDate(s.date)}</small>
                </td>
                <td>{s.customerName || "Cliente ocasional"}</td>
                <td>
                  <span className="badge" data-state={s.status}>
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td className="numeric">{bob(s.totalMinor)}</td>
                <td>
                  {actions(s)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-records">
        {page.items.map((s) => (
          <article className="card" key={s.id}>
            <strong>
              {s.number} · {bob(s.totalMinor)}
            </strong>
            <p>
              {localDate(s.date)} · {s.customerName || "Cliente ocasional"} ·{" "}
              <span className="badge" data-state={s.status}>
                {statusLabel(s.status)}
              </span>
            </p>
            {actions(s)}
          </article>
        ))}
      </div>
      {selection && (
        <ReturnForm key={selection.sale.id} sale={selection.sale} startExchange={selection.exchange} close={() => setSelection(null)} />
      )}
    </>
  );
}
