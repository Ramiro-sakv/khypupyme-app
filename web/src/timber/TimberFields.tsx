import { useState } from "react";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { get } from "../api/client";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, NoRecords, Pages } from "../commerce/CommerceUi";
import { bob } from "../commerce/models";
import type { Page, Product } from "../commerce/models";
import { dimension, displayMeasure, faceUnit, lengthUnit, timberLabel, timberVolume, volumeUnit } from "./measures";
import type { Capture, Dimensions, StockRow, TimberUnits } from "./measures";

export function TimberStockTable({ product, units, pick, detailed = false }: {
  product: Pick<Product, "id" | "name">; units: TimberUnits; pick?: (row: StockRow) => void; detailed?: boolean;
}) {
  const { revision } = useCommerce();
  const [filters, setFilters] = useState({ length: "", thickness: "", width: "", category: "" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const { length, thickness, width, category } = filters;
  return <>
    {detailed && <form className="history-toolbar" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      const options = new URLSearchParams();
      try {
        if (length.trim()) options.set("length", String(dimension(length, units, "length").value));
        if (thickness.trim()) options.set("thickness", String(dimension(thickness, units, "face").value));
        if (width.trim()) options.set("width", String(dimension(width, units, "face").value));
        if (category) options.set("category", category);
        setQuery(options.toString());
      } catch (failure) { setError((failure instanceof Error ? failure.message : "Revisa las medidas.") + " [400]"); }
    }}>
      <SelectField label="Categoría de largo" value={category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
        <option value="">Todas</option><option value="super-short">Supercorta · 1–2 pies</option>
        <option value="short">Corta · 3–6 pies</option><option value="long">Larga · 7–20 pies</option>
      </SelectField>
      <TextField label={"Largo exacto (" + lengthUnit(units) + ")"} value={length} onChange={(event) => setFilters({ ...filters, length: event.target.value })} />
      <TextField label={"Espesor (" + faceUnit(units) + ")"} value={thickness} onChange={(event) => setFilters({ ...filters, thickness: event.target.value })} />
      <TextField label={"Ancho (" + faceUnit(units) + ")"} value={width} onChange={(event) => setFilters({ ...filters, width: event.target.value })} />
      <Button type="submit" variant="secondary" icon="search">Filtrar medidas</Button>
    </form>}
    {error && <Alert tone="error">{error}</Alert>}
    <TimberRows key={[product.id, units, query, revision].join(":")} product={product} units={units} query={query} pick={pick} detailed={detailed} />
  </>;
}

function TimberRows({ product, units, pick, detailed, query }: {
  product: Pick<Product, "id" | "name">; units: TimberUnits; pick?: (row: StockRow) => void; detailed: boolean; query: string;
}) {
  const { path } = useCommerce();
  const [page, setPage] = useState(1);
  const endpoint = "/timber-stock/" + product.id + "?" + (query ? query + "&" : "") + "page=";
  const data = useCommerceData<Page<StockRow>>(endpoint + (detailed ? 1 : page));
  const [more, setMore] = useState<Page<StockRow>>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const items = [...new Map([...(data.data?.items ?? []), ...(more?.items ?? [])].map((row) => [JSON.stringify(row.timber), row])).values()];
  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await get<Page<StockRow>>(path + endpoint + (page + 1));
      setMore({ items: [...(more?.items ?? []), ...response.items], hasMore: response.hasMore });
      setPage(page + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudieron cargar más medidas."); }
    finally { setLoadingMore(false); }
  }
  return <>
    {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ?
      <NoRecords>No hay existencias por medida para {product.name}.</NoRecords> :
      <DataTable caption={"Existencias de " + product.name}
        columns={["Largo (" + lengthUnit(units) + ")", "Espesor (" + faceUnit(units) + ")",
          "Ancho (" + faceUnit(units) + ")", "Piezas", units === "metric" ? "m³" : "Pies tablares", pick ? "Acción" : "Valor"]}
        rows={items.map((row) => ({ id: JSON.stringify(row.timber), cells: [
          displayMeasure(row.timber.lengthMicros, units, "length"), displayMeasure(row.timber.thicknessMicros, units, "face"),
          displayMeasure(row.timber.widthMicros, units, "face"), row.stock,
          timberVolume([{ timber: row.timber, quantity: row.stock }], units),
          pick ? <Button variant="secondary" onClick={() => pick(row)}>Elegir {timberLabel(row.timber, units)}</Button> : bob(row.valueMinor),
        ] }))} />}
    {detailed ? <>
      {items.length > 0 && <p>{items.length} combinaciones cargadas</p>}
      {error && <Alert tone="error">{error}</Alert>}
      {(more?.hasMore ?? data.data?.hasMore) && <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
        {loadingMore ? "Cargando…" : "Cargar más"}
      </Button>}
    </> : <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />}
  </>;
}

export type TimberPreview = { timber: Dimensions; quantity: number; subtotal: number | null;
  requested: number; available?: number };

export function TimberFields({ name, species, productId, capture, onChange, onRemove, cost, costUnit, onCost, disabled, purchase, manualPrice, onPrice, onDuplicate,
  rows, notices, error, total }: {
  name: string; species: string; productId: string; capture: Capture; onChange: (value: Capture) => void; onRemove: () => void;
  cost: string; costUnit?: "board-foot"; onCost: (value: string) => void; disabled: boolean; purchase: boolean;
  manualPrice: string; onPrice: (value: string) => void; onDuplicate?: () => void;
  rows: TimberPreview[]; notices: string[]; error: string; total: number | null;
}) {
  const [selecting, setSelecting] = useState(false);
  const { units, selection } = capture;
  const costLabel = costUnit === "board-foot" ? "Costo por pie tablar" : "Costo por pieza";
  const pieces = rows.reduce((sum, row) => sum + row.quantity, 0);
  const volume = timberVolume(rows, units);
  function replaceWidth(width: number, quantity: number) {
    if (selection) {
      onChange({ ...capture, selection: quantity ? { ...selection, quantity: String(quantity) } : undefined, widths: "" });
      return;
    }
    const widths = rows.flatMap((row) => {
      const count = row.timber.widthMicros === width ? quantity : row.quantity;
      const measure = displayMeasure(row.timber.widthMicros, units, "face").replace(",", ".");
      return count ? [count === 1 ? measure : count + "x" + measure] : [];
    }).join(", ");
    onChange({ ...capture, widths });
  }
  return <Card className="timber-group">
    <div className="page-heading"><div><h3>{name}</h3><p>{species}</p></div>
      <div className="inline-actions">
        {onDuplicate && <Button variant="secondary" onClick={onDuplicate} disabled={disabled}>Duplicar grupo</Button>}
        <Button variant="plain" onClick={onRemove} disabled={disabled}>Quitar grupo</Button>
      </div>
    </div>
    {selection ? <>
      <p>{timberLabel(selection.timber, units)}</p>
      <TextField label="Piezas de la medida elegida" inputMode="numeric" value={selection.quantity}
        disabled={disabled} onChange={(event) => onChange({ ...capture, selection: { ...selection, quantity: event.target.value } })} />
      <Button variant="secondary" disabled={disabled} onClick={() => onChange({ ...capture, selection: undefined })}>Escribir otras medidas</Button>
    </> : <div className="timber-inputs">
      <TextField label={"Largo (" + lengthUnit(units) + ")"} value={capture.length} disabled={disabled}
        onChange={(event) => onChange({ ...capture, length: event.target.value })} />
      <TextField label={"Espesor (" + faceUnit(units) + ")"} value={capture.thickness} disabled={disabled}
        onChange={(event) => onChange({ ...capture, thickness: event.target.value })} />
      <label className="field timber-widths"><span>{"Anchos (" + faceUnit(units) + ")"}</span>
        <textarea value={capture.widths} disabled={disabled} onChange={(event) => onChange({ ...capture, widths: event.target.value })}
          rows={2} placeholder={units === "metric" ? "152.4, 2x203.2" : "6, 10, 5, 3 o 5x10, 4x7"} />
        <small>Separa con comas, punto y coma o saltos de línea. Usa punto para decimales.</small>
      </label>
      {capture.widths && <Button variant="secondary" disabled={disabled} onClick={() => onChange({ ...capture, widths: "" })}>Vaciar anchos</Button>}
    </div>}
    {purchase ? <TextField label={costLabel + " (Bs)"} value={cost} inputMode="decimal" disabled={disabled}
      onChange={(event) => onCost(event.target.value)} /> :
      <div className="timber-price-and-stock">
        <TextField label="Tarifa pactada por pie tablar (Bs)" hint="Opcional. Si lo dejas vacío se usa la tarifa del catálogo."
          value={manualPrice} inputMode="decimal" disabled={disabled} onChange={(event) => onPrice(event.target.value)} />
        <Button variant="secondary" disabled={disabled} onClick={() => setSelecting(!selecting)} aria-expanded={selecting}>
          {selecting ? "Ocultar medidas disponibles" : "Elegir medida disponible"}
        </Button>
        {selecting && !disabled && <TimberStockTable product={{ id: productId, name }} units={units} pick={(row) => {
          onChange({ ...capture, selection: { timber: row.timber, quantity: "1" } }); setSelecting(false);
        }} />}
      </div>}
    {error && <p className="trade-issue">{error}</p>}
    {notices.map((notice) => <p key={notice}>{notice}</p>)}
    {rows.length > 0 && <>
      <dl className="cash-metrics timber-metrics">
        <div><dt>Piezas</dt><dd>{pieces}</dd></div>
        <div><dt>{volumeUnit(units)}</dt><dd>{volume}</dd>
          {units === "metric" && <small>{timberVolume(rows, "imperial")} pies tablares</small>}</div>
        <div><dt>Subtotal</dt><dd>{total === null ? "Pendiente" : bob(total)}</dd></div>
      </dl>
      <DataTable caption={"Desglose de " + name} columns={["Ancho (" + faceUnit(units) + ")", "Piezas",
        volumeUnit(units), "Subtotal", ...(purchase ? [] : ["Disponibilidad"]), "Acción"]}
        rows={rows.map((row) => ({ id: JSON.stringify(row.timber), cells: [
          displayMeasure(row.timber.widthMicros, units, "face"),
          selection ? row.quantity : <TextField label={"Piezas del ancho " + displayMeasure(row.timber.widthMicros, units, "face")}
            type="number" min={1} max={1_000_000} value={row.quantity} disabled={disabled}
            onChange={(event) => {
              if (/^\d+$/.test(event.target.value) && event.target.valueAsNumber >= 1 && event.target.valueAsNumber <= 1_000_000)
                replaceWidth(row.timber.widthMicros, event.target.valueAsNumber);
            }} />,
          timberVolume([row], units),
          row.subtotal === null ? "Pendiente" : bob(row.subtotal),
          ...(purchase ? [] : [row.available === undefined ? "Por comprobar" :
            <span className={row.requested > row.available ? "trade-issue" : undefined}>
              {row.available === 0 && "Sin stock · "}Pedido {row.requested} · Disponible {row.available}
              {row.requested > row.available ? " · Faltan " + (row.requested - row.available) : ""}
            </span>]),
          <Button variant="plain" disabled={disabled} onClick={() => replaceWidth(row.timber.widthMicros, 0)}>Quitar ancho</Button>,
        ] }))} />
      <p className="trade-total">{pieces} piezas · {volume} {volumeUnit(units)} · {total === null ? "Pendiente" : bob(total)}</p>
      {purchase && total === null && <Alert>Completa el {costLabel.toLowerCase()}.</Alert>}
    </>}
  </Card>;
}
