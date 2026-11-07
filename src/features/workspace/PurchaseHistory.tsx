import type { TimberSelection } from "../../../shared/workspace/model";
import {
  timberSelectionText,
  timberTotals,
} from "../../../shared/workspace/timber-groups";
import { useState } from "react";
import { UNITS } from "../../../shared/workspace/catalog";
import type { Quantity } from "../../../shared/workspace/exact";
import { showQuantity } from "../../../shared/workspace/exact";
import type { Item, Method, Unit } from "../../../shared/workspace/model";
import { Panel } from "./Panel";
import { useRecords } from "./context";
import { bob, localDate, statusLabel } from "./format";
import { useWorkspaceNavigation } from "./navigation";
import { Pager } from "./ui";
interface PurchaseRecord {
  id: string;
  number: string;
  date: string;
  reference: string;
  method: Method;
  totalMinor: number;
  lines: {
    name: string;
    qty: Quantity;
    unit: Unit;
    timber?: TimberSelection;
    fields?: Record<string, string>;
    unitCostMinor: number;
    totalMinor: number;
    lot?: string;
    expiresOn?: string;
    serials?: string[];
  }[];
}
export default function PurchaseHistory() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [product, setProduct] = useState(""),
    [selectedId, setSelected] = useState(""),
    products = useRecords<Item>("items"),
    ready = (!from && !to) || (!!from && !!to),
    page = useRecords<PurchaseRecord>(
      "purchasesV2",
      {
        ...(from && to ? { from, to } : {}),
        ...(product ? { itemId: product } : {}),
      },
      ready,
    ),
    { go } = useWorkspaceNavigation(),
    selected = ready
      ? page.items.find((row) => row.id === selectedId)
      : undefined;
  return (
    <section data-tutorial="purchase-history" className="purchase-history">
      <h2>Compras registradas</h2>
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
        <label>
          Producto de esta página del catálogo
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Todos</option>
            {product && !products.items.some((i) => i.id === product) && (
              <option value={product}>Producto seleccionado</option>
            )}
            {products.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details>
        <summary>Cambiar página de productos del filtro</summary>
        <Pager page={products} />
      </details>
      {!ready ? (
        <p className="notice notice-info">
          Completa ambas fechas para consultar el periodo.
        </p>
      ) : (
        <>
          <Pager page={page} />
          <div className="table-scroll desktop-records">
            <table>
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Referencia</th>
                  <th>Pago</th>
                  <th className="numeric">Importe</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.number}</strong>
                      <small>{localDate(p.date)}</small>
                    </td>
                    <td>{p.reference || "Sin referencia"}</td>
                    <td>{statusLabel(p.method)}</td>
                    <td className="numeric">{bob(p.totalMinor)}</td>
                    <td>
                      <button onClick={() => setSelected(p.id)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-records">
            {page.items.map((p) => (
              <article key={p.id} className="card list-card">
                <h3>{p.number}</h3>
                <p>
                  {localDate(p.date)} · {p.reference || "Sin referencia"}
                </p>
                <strong>{bob(p.totalMinor)}</strong>
                <button onClick={() => setSelected(p.id)}>Ver detalle</button>
              </article>
            ))}
          </div>
        </>
      )}
      {selected && (
        <Panel
          title={"Compra " + selected.number}
          onClose={() => setSelected("")}
        >
          <p className="muted">
            Datos de la compra original, dentro del periodo y filtro
            consultados.
          </p>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{localDate(selected.date)}</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>{selected.reference || "Sin referencia"}</dd>
            </div>
            <div>
              <dt>Forma de pago</dt>
              <dd>{statusLabel(selected.method)}</dd>
            </div>
          </dl>
          {selected.lines.map((line, index) => (
            <section className="card list-card" key={index}>
              <h3>{line.name}</h3>
              <p>
                {line.timber && line.fields
                  ? timberSelectionText(line.fields.thicknessMm!, line.timber) +
                    " · " +
                    showQuantity(
                      timberTotals(line.fields.thicknessMm!, line.timber)
                        .boardFeet,
                    ) +
                    " pies tablares × "
                  : showQuantity(line.qty) +
                    " " +
                    UNITS[line.unit] +
                    " × "}{" "}
                {bob(line.unitCostMinor)}
              </p>
              <strong>{bob(line.totalMinor)}</strong>
              {line.lot && <p>Lote: {line.lot}</p>}
              {line.expiresOn && (
                <p>Vencimiento: {localDate(line.expiresOn)}</p>
              )}
              {!!line.serials?.length && (
                <p>Series: {line.serials.join(", ")}</p>
              )}
            </section>
          ))}
          <div className="notice">
            <strong>Total pagado: {bob(selected.totalMinor)}</strong>
          </div>
          <button
            onClick={() => {
              setSelected("");
              go("documentos");
            }}
          >
            Abrir documentos emitidos
          </button>
        </Panel>
      )}
    </section>
  );
}
