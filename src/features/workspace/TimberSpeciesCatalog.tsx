import AuditHistory from "./AuditHistory";
import TimberStockTable from "./TimberStockTable";
import { div } from "../../../shared/workspace/exact";
import type { Quantity } from "../../../shared/workspace/exact";
import { displayQuantity } from "../../../shared/workspace/presentation";
import { useState } from "react";
import type { TimberCategory, TimberSpecies, TimberSummary } from "../../../shared/workspace/model";
import { TIMBER_CATEGORIES, timberSpeciesItem, timberThickness } from "../../../shared/workspace/timber-species";
import { timberVolumeLabel } from "../../../shared/workspace/timber-groups";
import { dimensionDisplayFromMm, dimensionToMm } from "../../../shared/workspace/timber-measures";
import { useRecords, useWorkspace } from "./context";
import { errorMessage } from "../../shared/errors";
import { bob, cents } from "./format";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
import TimberAdjustment from "./TimberAdjustment";

function speciesVolume(volume: Quantity, system: "imperial" | "metric" = "imperial") {
  return system === "metric" ? displayQuantity(div(volume, { n: "1000000000", d: "1" })) + " m³" : timberVolumeLabel(volume);
}
function SpeciesForm({ initial, onDone }: { initial?: TimberSpecies; onDone: () => void; }) {
  const { run, busy } = useWorkspace(), [id] = useState(() => initial?.id ?? crypto.randomUUID());
  return <ActionForm dataTutorial="item-form" disabled={busy} label={initial ? "Guardar tarifas y estado" : "Crear producto sin existencias"} onSave={async (data) => {
    const result = await run({
      kind: "timber-species", input: {
        id, name: String(data.get("name")), species: String(data.get("species")), code: String(data.get("code") ?? ""), reference: String(data.get("reference") ?? ""),
        expectedRevision: initial?.revision ?? 0, active: initial ? data.get("active") === "on" : true,
        prices: Object.fromEntries(Object.keys(TIMBER_CATEGORIES).map((key) => [key, cents(data.get(key))])) as Record<TimberCategory, number>,
      }
    });
    if (result) onDone();
  }}>
    <Field name="name" label="Nombre del producto" maxLength={80} value={initial?.name ?? ""} />
    <Field name="species" label="Especie" maxLength={80} value={initial?.species ?? ""} />
    <Field name="code" label="Código único (automático si lo dejas vacío)" maxLength={40} required={false} value={initial?.code ?? ""} />
    <Field name="reference" label="Referencia (opcional)" required={false} maxLength={40} value={initial?.reference ?? ""} />
    <p>Un producto identificado por su código, con todos sus espesores. Las medidas se indican al recibir madera.</p>
    {(Object.keys(TIMBER_CATEGORIES) as TimberCategory[]).map((category) => <Field key={category} name={category} label={TIMBER_CATEGORIES[category] + " · BOB por pie tablar"} type="number" min="0.01" step="0.01" value={initial ? (initial.prices[category] / 100).toFixed(2) : ""} />)}
    <p className="muted">Estas tarifas se aplican a todos los espesores del producto. Los documentos anteriores conservan sus precios.</p>
    {initial && <label>
      <input type="checkbox" name="active" defaultChecked={initial.active} />Especie activa</label>}
  </ActionForm>;
}
function SpeciesSummary({ species }: { species: TimberSpecies }) {
  const { business } = useWorkspace();
  const [category, setCategory] = useState(""), [thickness, setThickness] = useState(""), [thicknessInput, setThicknessInput] = useState(""), [measureError, setMeasureError] = useState("");
  const summary = useRecords<TimberSummary>("timberSummary", { itemId: species.id, ...(category ? { category: category as TimberCategory } : {}), ...(thickness ? { thicknessMm: thickness } : {}) }, !measureError);
  const rows = measureError ? [] : summary.items;
  const measures = useRecords<{ id: string; lengthMm: string; widthMm: string; pieces: number; }>("timberGroups", { itemId: species.id, thicknessMm: thickness, active: true }, !!thickness);
  return <>
    <p>{species.pieces} piezas · {speciesVolume(species.balance, business.timberSystem)} · valor {bob(species.valueMinor)}</p>

    <div className="workspace-grid">
      <label>Categoría<select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Todas</option>{Object.entries(TIMBER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </label>
      <label>Filtrar espesor ({business.timberSystem === "metric" ? "mm" : "pulgadas"})<input value={thicknessInput} placeholder="Todos · escribe un espesor" onChange={(e) => {
        setThicknessInput(e.target.value);
        try { setThickness(e.target.value.trim() ? timberThickness(dimensionToMm(e.target.value, "thicknessMm", business.timberSystem ?? "imperial")) : ""); setMeasureError(""); }
        catch (cause) { setThickness(""); setMeasureError(errorMessage(cause)); }
      }} />
      </label>
    </div>
    {measureError ? <p role="alert">{measureError}</p> : <Pager page={summary} />}
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Espesor ({business.timberSystem === "metric" ? "mm" : "pulgadas"})</th>
            <th>Categoría</th>
            <th>Piezas</th>
            <th>Volumen</th>
          </tr>
        </thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td>{dimensionDisplayFromMm(row.thicknessMm, "thicknessMm", business.timberSystem ?? "imperial")}</td>
          <td>{TIMBER_CATEGORIES[row.category]}</td>
          <td>{row.pieces}</td>
          <td>{speciesVolume(row.volume, business.timberSystem)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!measureError && !summary.loading && !summary.error && !summary.items.length && <p>Sin existencias. Registra una compra o una entrada con costo.</p>}
    {thickness && <details>
      <summary>Medidas exactas del espesor seleccionado</summary>
      <Pager page={measures} />{measures.items.map((group) => <p key={group.id}>{dimensionDisplayFromMm(group.lengthMm, "lengthMm", business.timberSystem ?? "imperial")}{business.timberSystem === "metric" ? " mm" : " pies"} de largo × {dimensionDisplayFromMm(group.widthMm, "widthMm", business.timberSystem ?? "imperial")}{business.timberSystem === "metric" ? " mm" : " pulgadas"} de ancho · {group.pieces} piezas</p>)}</details>}

  </>;
}
function SpeciesDetail({ species, onEdit }: { species: TimberSpecies; onEdit: () => void }) {
  return <><div className="product-identity"><strong>{species.name}</strong><span>Especie: {species.species ?? "Especie por completar"}</span><span>Código: {species.code ?? "Por asignar"}</span></div>
    <button type="button" onClick={onEdit}>Editar ficha y tarifas / archivar</button>
    <TimberStockTable product={species} />
    <details><summary>Historial de cambios de esta ficha</summary><AuditHistory itemId={species.id} /></details>
    <details><summary>Resumen secundario por categoría y espesor</summary><SpeciesSummary species={species} /></details>
    {species.active && <TimberAdjustment item={timberSpeciesItem(species)} />}
  </>;
}
export default function TimberSpeciesCatalog() {
  const { busy, business } = useWorkspace();
  const [search, setSearch] = useState(""), [archived, setArchived] = useState(false), [create, setCreate] = useState(false), [selected, setSelected] = useState<TimberSpecies | null>(null), [editing, setEditing] = useState(false);
  const page = useRecords<TimberSpecies>("timberSpecies", { active: !archived, ...(search.trim().length >= 2 ? { search: search.trim() } : {}) });
  const current = page.items.find((row) => row.id === selected?.id) ?? selected;
  return <section className="timber-species-catalog">
    <div className="section-heading">
      <h3>Productos de madera</h3>
      <button className="primary" data-tutorial="new-item" disabled={busy} onClick={() => setCreate(true)}>Nuevo producto</button>
    </div>
    <p>Supercortas 1–2 pies · cortas 3–6 pies · largas 7–20 pies. Cada producto tiene tres tarifas, para todos sus espesores.</p>
    <div className="workspace-grid">
      <label>Buscar producto, especie, código o referencia<input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <label>
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />Ver archivadas</label>
    </div>
    <Pager page={page} />
    <div className="records-grid">{page.items.map((species) => <article className="card" key={species.id}>
      <h3>{species.name}</h3>
      <p>Especie: {species.species ?? "Especie por completar"} · Código: {species.code ?? "Por asignar"}</p><p>{species.reference}</p>
      <strong>{species.pieces} piezas · {speciesVolume(species.balance, business.timberSystem)}</strong>
      <p>Valor: {bob(species.valueMinor)}</p>
      <dl>{(Object.keys(TIMBER_CATEGORIES) as TimberCategory[]).map((key) => <div key={key}>
        <dt>{TIMBER_CATEGORIES[key]}</dt>
        <dd>{bob(species.prices[key])}/pt</dd>
      </div>)}</dl>
      <button type="button" disabled={busy} onClick={() => { setSelected(species); setEditing(false); }}>Existencias, entradas y tarifas</button>
    </article>)}</div>
    {create && <Panel title="Nuevo producto de madera" onClose={() => setCreate(false)}>
      <SpeciesForm onDone={() => setCreate(false)} />
    </Panel>}
    {current && <Panel className="inventory-detail-panel" title={current.name} onClose={() => setSelected(null)}>{editing ? <SpeciesForm key={current.revision} initial={current} onDone={() => { setSelected(null); setEditing(false); }} /> : <SpeciesDetail species={current} onEdit={() => setEditing(true)} />}</Panel>}
  </section>;
}
