import { useState } from "react";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords } from "./context";
import { bob, localDate, statusLabel } from "./format";
import { Pager } from "./ui";

import ReturnForm from "./ReturnForm";
import Trade from "./Trade";
export default function SalesPage() {
  return (
    <>
      <Trade />
      <SalesHistory />
    </>
  );
}
export function SalesHistory() {
  const page = useRecords<SaleV2>("salesV2"),
    [sale, setSale] = useState<SaleV2 | null>(null);
  return (
    <>
      <h2>Ventas y devoluciones</h2>
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
                  <button onClick={() => setSale(s)}>
                    Detalle y devolución
                  </button>
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
            <button onClick={() => setSale(s)}>
              Detalle / devolver / cambiar
            </button>
          </article>
        ))}
      </div>
      {sale && (
        <ReturnForm key={sale.id} sale={sale} close={() => setSale(null)} />
      )}
    </>
  );
}
