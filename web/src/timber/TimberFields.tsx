import { useState } from "react";
import { Alert, Button, Card, DataTable, TextField } from "../ui/Primitives";
import { useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, NoRecords, Pages } from "../commerce/CommerceUi";
import { bob } from "../commerce/models";
import type { Page, Product } from "../commerce/models";
import { displayMeasure, faceUnit, lengthUnit, timberLabel, timberVolume, volumeUnit } from "./measures";
import type { Capture, Dimensions, StockRow, TimberUnits } from "./measures";

export function TimberStockTable({ product, units, pick }: {
  product: Pick<Product, "id" | "name">; units: TimberUnits; pick?: (row: StockRow) => void;
}) {
  const [page, setPage] = useState(1);
  const data = useCommerceData<Page<StockRow>>("/timber-stock/" + product.id + "?page=" + page);
  return <>
    {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ?
      <NoRecords>No hay existencias por medida para {product.name}.</NoRecords> :
      <DataTable caption={"Existencias de " + product.name}
        columns={["Largo (" + lengthUnit(units) + ")", "Espesor (" + faceUnit(units) + ")",
          "Ancho (" + faceUnit(units) + ")", "Piezas", units === "metric" ? "m³" : "Pies tablares", pick ? "Acción" : "Valor"]}
        rows={data.data.items.map((row) => ({ id: JSON.stringify(row.timber), cells: [
          displayMeasure(row.timber.lengthMicros, units, "length"), displayMeasure(row.timber.thicknessMicros, units, "face"),
          displayMeasure(row.timber.widthMicros, units, "face"), row.stock,
          timberVolume([{ timber: row.timber, quantity: row.stock }], units),
          pick ? <Button variant="secondary" onClick={() => pick(row)}>Elegir {timberLabel(row.timber, units)}</Button> : bob(row.valueMinor),
        ] }))} />}
    <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
  </>;
}

export type TimberPreview = { timber: Dimensions; quantity: number; subtotal: number | null;
  requested: number; available?: number };

export function TimberFields({ name, species, productId, capture, onChange, onRemove, cost, onCost, disabled, purchase,
  rows, notices, error, total }: {
  name: string; species: string; productId: string; capture: Capture; onChange: (value: Capture) => void; onRemove: () => void;
  cost: string; onCost: (value: string) => void; disabled: boolean; purchase: boolean;
  rows: TimberPreview[]; notices: string[]; error: string; total: number | null;
}) {
  const [selecting, setSelecting] = useState(false);
  const { units, selection } = capture;
  return <Card className="timber-group">
    <div className="page-heading"><div><h3>{name}</h3><p>{species}</p></div>
      <Button variant="plain" onClick={onRemove} disabled={disabled}>Quitar grupo</Button>
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
    </div>}
    {purchase ? <TextField label="Costo por pieza (Bs)" value={cost} inputMode="decimal" disabled={disabled}
      onChange={(event) => onCost(event.target.value)} /> :
      <div>
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
      <DataTable caption={"Desglose de " + name} columns={["Ancho (" + faceUnit(units) + ")", "Piezas", "Subtotal", ...(purchase ? [] : ["Disponibilidad"])]}
        rows={rows.map((row) => ({ id: JSON.stringify(row.timber), cells: [
          displayMeasure(row.timber.widthMicros, units, "face"), row.quantity, row.subtotal === null ? "Pendiente" : bob(row.subtotal),
          ...(purchase ? [] : [row.available === undefined ? "Por comprobar" :
            <span className={row.requested > row.available ? "trade-issue" : undefined}>
              Pedido {row.requested} · Disponible {row.available}
              {row.requested > row.available ? " · Faltan " + (row.requested - row.available) : ""}
            </span>]),
        ] }))} />
      <p className="trade-total">{rows.reduce((sum, row) => sum + row.quantity, 0)} piezas · {timberVolume(rows, units)} {volumeUnit(units)} · {total === null ? "Pendiente" : bob(total)}</p>
      {purchase && total === null && <Alert>Completa el costo por pieza.</Alert>}
    </>}
  </Card>;
}
