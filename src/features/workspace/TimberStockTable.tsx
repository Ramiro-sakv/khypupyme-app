import { Fragment, useEffect, useState } from "react";
import type { TimberCategory, TimberSpecies, TimberStockRow, WorkspaceQuery } from "../../../shared/workspace/model";
import { TIMBER_CATEGORIES, timberThickness, timberCategory } from "../../../shared/workspace/timber-species";
import { dimensionToMm, dimensionDisplayFromMm, BOARD_FOOT_MM3 } from "../../../shared/workspace/timber-measures";
import { add, div, ZERO } from "../../../shared/workspace/exact";
import { displayQuantity } from "../../../shared/workspace/presentation";
import { errorMessage } from "../../shared/errors";
import { useWorkspace } from "./context";
import type { Page } from "./WorkspaceRepository";

export default function TimberStockTable({ product }: { product: TimberSpecies }) {
  const { repository, business, revision } = useWorkspace(), system = business.timberSystem ?? "imperial";
  const [category, setCategory] = useState(""), [length, setLength] = useState(""), [thickness, setThickness] = useState(""), [width, setWidth] = useState("");
  let issue = "";
  const filters: Partial<WorkspaceQuery> = { itemId: product.id };
  try {
    if (category) filters.category = category as TimberCategory;
    if (length.trim()) { filters.lengthMm = dimensionToMm(length, "lengthMm", system); timberCategory(filters.lengthMm); }
    if (thickness.trim()) filters.thicknessMm = timberThickness(dimensionToMm(thickness, "thicknessMm", system));
    if (width.trim()) filters.widthMm = timberThickness(dimensionToMm(width, "widthMm", system));
  } catch (cause) { issue = errorMessage(cause); }
  const filterKey = JSON.stringify(filters), key = JSON.stringify([business.id, product.id, revision, filterKey]);
  const [paging, setPaging] = useState({ key: "", cursor: "" }), [refresh, setRefresh] = useState(0);
  const cursor = paging.key === key ? paging.cursor : "", requestKey = JSON.stringify([key, cursor, refresh]);
  const [result, setResult] = useState<{ key: string; requestKey: string; page: Page<TimberStockRow> } | null>(null);
  const [error, setError] = useState({ key: "", message: "" });
  useEffect(() => {
    if (issue) return;
    let active = true;
    repository.list<TimberStockRow>({ apiVersion: 2, businessId: business.id, resource: "timberStock", ...JSON.parse(filterKey), ...(cursor ? { cursor } : {}) })
      .then((page) => {
        if (active) setResult((old) => {
          const previous = cursor && old?.key === key ? old.page.items : [];
          const rows = [...new Map([...previous, ...page.items].map((row) => [row.id, row])).values()];
          return { key, requestKey, page: { ...page, items: rows } };
        });
      }).catch((cause) => { if (active) setError({ key: requestKey, message: errorMessage(cause) }); });
    return () => { active = false; };
  }, [repository, business.id, key, requestKey, filterKey, cursor, issue]);
  const current = !issue && result?.key === key ? result.page : null;
  const failure = error.key === requestKey ? error.message : "";
  const loading = !issue && result?.requestKey !== requestKey && !failure;
  const rows = current?.items ?? [];
  const pieces = rows.reduce((sum, row) => sum + row.pieces, 0), volume = rows.reduce((sum, row) => add(sum, row.volume), ZERO);
  const volumeLabel = (value: typeof volume) => displayQuantity(div(value, system === "metric" ? { n: "1000000000", d: "1" } : BOARD_FOOT_MM3)) + (system === "metric" ? " m³" : " pies tablares");
  const dimension = (value: string, field: string) => dimensionDisplayFromMm(value, field, system);
  return <section className="timber-stock-detail">
    <h3>Existencias por largo, espesor y ancho</h3>
    <div className="stock-filters">
      <label>Categoría<select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Todas</option>{Object.entries(TIMBER_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <label>Largo ({system === "imperial" ? "pies" : "mm"})<input value={length} onChange={(e) => setLength(e.target.value)} placeholder="Todos" />
      </label>
      <label>Espesor ({system === "imperial" ? "pulgadas" : "mm"})<input value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="Todos" />
      </label>
      <label>Ancho ({system === "imperial" ? "pulgadas" : "mm"})<input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="Todos" />
      </label>
      <button type="button" onClick={() => { setCategory(""); setLength(""); setThickness(""); setWidth(""); setPaging({ key: "", cursor: "" }); setRefresh((n) => n + 1); }}>Limpiar filtros / actualizar</button>
    </div>
    {issue && <p role="alert">{issue}</p>}
    {failure && <div role="alert">
      <p>{failure}</p>
      <button type="button" onClick={() => setRefresh((n) => n + 1)}>Reintentar consulta</button>
    </div>}
    {current?.totals && <p className="notice">Total con estos filtros: {current.totals.pieces} piezas · {volumeLabel(current.totals.volume)} · {current.totals.combinations} combinaciones.</p>}
    <p className="muted">Cargadas: {rows.length} combinaciones · {pieces} piezas · {volumeLabel(volume)}. Cada fila es una medida disponible.</p>
    <div className="table-scroll">
      <table className="timber-stock-table">
        <thead>
          <tr>
            <th>Largo ({system === "imperial" ? "pies" : "mm"})</th>
            <th>Espesor ({system === "imperial" ? "pulgadas" : "mm"})</th>
            <th>Ancho ({system === "imperial" ? "pulgadas" : "mm"})</th>
            <th>Piezas disponibles</th>
            <th>{system === "imperial" ? "Pies tablares" : "Volumen m³"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <Fragment key={row.id}>
            {(!index || rows[index - 1]!.lengthMm !== row.lengthMm || rows[index - 1]!.thicknessMm !== row.thicknessMm) && <tr className="stock-group-heading">
              <th colSpan={5}>Largo {dimension(row.lengthMm, "lengthMm")}{system === "imperial" ? "′" : " mm"} · espesor {dimension(row.thicknessMm, "thicknessMm")}{system === "imperial" ? "″" : " mm"} · {TIMBER_CATEGORIES[row.category]}</th>
            </tr>}
            <tr>
              <td>{dimension(row.lengthMm, "lengthMm")}</td>
              <td>{dimension(row.thicknessMm, "thicknessMm")}</td>
              <td>{dimension(row.widthMm, "widthMm")}</td>
              <td>{row.pieces}</td>
              <td>{volumeLabel(row.volume)}</td>
            </tr>
          </Fragment>)}
        </tbody>
      </table>
    </div>
    {loading && <p role="status">Consultando existencias…</p>}
    {!loading && !failure && !issue && !rows.length && <p>No hay existencias con estas medidas. Cambia los filtros o registra una entrada.</p>}
    {current?.next && <button type="button" disabled={loading} onClick={() => setPaging({ key, cursor: current.next! })}>Cargar 100 combinaciones más</button>}
  </section>;
}
