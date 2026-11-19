import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, get } from "../api/client";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, Pages, SearchForm } from "../commerce/CommerceUi";
import { bob, dateLabel } from "../commerce/models";
import type { Page, Product } from "../commerce/models";
import { baseUnit, fromBase, quantityLabel, retailUnits, unitLabels } from "./measures";
import type { Lot, Measure, Serial } from "./measures";

export function BarcodeField({ add, disabled, focus, accepts }: {
  add: (product: Product) => void; disabled: boolean; focus?: boolean; accepts: (product: Product) => boolean;
}) {
  const { path } = useCommerce();
  const field = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  return <form className="barcode-field" onSubmit={async (event) => {
    event.preventDefault();
    if (disabled || busy) return;
    if (!code.trim()) {
      setError("Escribe o escanea el código del producto. [400]");
      setStatus("");
      field.current?.focus();
      return;
    }
    setBusy(true); setError(""); setStatus("");
    try {
      const product = await get<Product>(path + "/products/code?" + new URLSearchParams({ code: code.trim() }));
      if (!accepts(product)) {
        setError("Este producto no se puede añadir a esta operación. [400]");
        return;
      }
      add(product); setCode(""); setStatus(product.name + " añadido.");
    } catch (error) {
      setError(error instanceof ApiError && error.status === 404 ? "No hay un producto activo con ese código. [404]" :
        error instanceof Error ? error.message : "No se pudo consultar el código.");
    } finally { setBusy(false); field.current?.focus(); }
  }}>
    <TextField ref={field} data-entry-focus={focus || undefined} label="Código o lector"
      hint="Escanea el código o escríbelo y pulsa Enter." error={error || undefined}
      value={code} maxLength={40} disabled={disabled} onChange={(event) => { setCode(event.target.value); setError(""); setStatus(""); }} />
    <Button type="submit" icon="barcode" disabled={disabled || busy}>{busy ? "Buscando…" : "Añadir por código"}</Button>
    {status && <small role="status">{status}</small>}
  </form>;
}

export function VariantMatrix({ model, choose, disabled, excluded, requireStock }: {
  model: string; choose?: (product: Product) => void; disabled?: boolean; excluded?: string; requireStock?: boolean;
}) {
  const query = useCommerceData<Product[]>("/variants?" + new URLSearchParams({ model }));
  const variants = query.data;
  if (!variants) return <LoadFeedback {...query} />;
  const matrix = new Map<string, Product>();
  for (const product of variants) {
    if (product.apparel) matrix.set(product.apparel.size.toUpperCase() + "\u001f" + product.apparel.color.toUpperCase(), product);
  }
  const choices = (field: "size" | "color") => [...new Map(variants.flatMap((product) => product.apparel ?
    [[product.apparel[field].toUpperCase(), product.apparel[field]] as const] : [])).values()];
  const colors = choices("color");
  const sizes = choices("size");
  if (!matrix.size) return <Alert>No hay variantes activas para este modelo.</Alert>;
  return <DataTable caption={model + " · disponibilidad por talla y color"} columns={["Talla", ...colors]}
    rows={sizes.map((size) => ({ id: size, cells: [size, ...colors.map((color) => {
      const product = matrix.get(size.toUpperCase() + "\u001f" + color.toUpperCase());
      if (!product) return <span aria-label="No registrado">—</span>;
      if (!choose) return product.stock === 0 ? "Sin stock" : product.stock + " disp.";
      return <Button variant="secondary" aria-label={"Talla " + size + ", " + color + ", " + product.stock +
        (product.specialty?.countUnit === "pair" ? " pares disponibles" : " disponibles")}
        disabled={disabled || product.id === excluded || requireStock && product.stock === 0}
        onClick={() => choose(product)}>{product.stock ? product.stock + (product.specialty?.countUnit === "pair" ? " pares" : " disp.") : "Sin stock"} · {bob(product.priceMinor)}</Button>;
    })] }))} />;
}

export function MeasuredFields({ profile, quantity, measure, buying, mixed, boxSale, bag, lockedQuantity, disabled, onQuantity, onMeasure }: {
  profile: NonNullable<Product["retail"]>; quantity: string; measure: Omit<Measure, "quantity">; buying: boolean; mixed?: boolean; disabled: boolean;
  boxSale?: boolean; bag?: boolean; lockedQuantity?: boolean;
  onQuantity: (quantity: string) => void; onMeasure: (measure: Omit<Measure, "quantity">) => void;
}) {
  return <div className="store-fields">
    <TextField label={bag ? "Bolsas" : (mixed || boxSale) && measure.unit === "box" ? "Cajas" : "Cantidad"}
      inputMode="decimal" value={quantity} disabled={disabled} readOnly={lockedQuantity}
      onChange={(event) => onQuantity(event.target.value)} />
    <SelectField label="Unidad" value={measure.unit} disabled={disabled} onChange={(event) => onMeasure({ ...measure, unit: event.target.value, loose: undefined })}>
      {retailUnits(profile, buying, mixed, boxSale).map((unit) => <option value={unit} key={unit}>
        {unit === "box" && mixed ? "Cajas y sueltos" : unit === "piece" && bag ? "bolsa" : unit === "piece" && boxSale ? "pieza" : unitLabels[unit]}</option>)}
    </SelectField>
    {mixed && measure.unit === "box" && <TextField label="Unidades sueltas" type="number" min={0} max={1_000_000}
      step={1} value={measure.loose ?? 0} disabled={disabled} onChange={(event) => onMeasure({ ...measure, loose: Number(event.target.value) })} />}
    {buying && profile.trackLots && <>
      <TextField label="Código del lote" maxLength={60} value={measure.lot ?? ""} disabled={disabled}
        onChange={(event) => onMeasure({ ...measure, lot: event.target.value })} />
      <TextField label="Vencimiento del lote (opcional)" type="date" value={measure.expiresOn ?? ""} disabled={disabled}
        onChange={(event) => onMeasure({ ...measure, expiresOn: event.target.value || undefined })} />
    </>}
  </div>;
}

export function SerialPicker({ productId, selected, choose, disabled }: {
  productId: string; selected: string[]; choose: (serials: string[]) => void; disabled: boolean;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useCommerceData<Page<Serial>>("/serials?" + new URLSearchParams({ product: productId, state: "available", search, page: String(page) }));
  return <Card className="serial-picker">
    <SearchForm label="Buscar serie disponible" onSearch={(value) => { setSearch(value); setPage(1); }} />
    {selected.length > 0 && <div className="inline-actions">{selected.map((serial) =>
      <Button key={serial} variant="secondary" disabled={disabled} onClick={() => choose(selected.filter((item) => item !== serial))}>
        Quitar {serial}
      </Button>)}</div>}
    {!query.data ? <LoadFeedback {...query} /> : query.data.items.length === 0 ? <p>No hay series disponibles en esta búsqueda.</p> :
      <div className="store-series">{query.data.items.map((unit) => <label key={unit.serial} className="trade-check">
        <input type="checkbox" checked={selected.includes(unit.serial)} disabled={disabled}
          onChange={(event) => choose(event.target.checked ? [...selected, unit.serial] : selected.filter((item) => item !== unit.serial))} />
        {unit.serial}
      </label>)}</div>}
    <Pages index={page} hasMore={query.data?.hasMore} onChange={setPage} />
  </Card>;
}

export function LotsTable({ product, choose, actions }: { product: Product; choose?: (lot: Lot) => void;
  actions?: (lot: Lot) => ReactNode }) {
  const [page, setPage] = useState(1);
  const query = useCommerceData<Page<Lot>>("/lots/" + product.id + "?page=" + page);
  if (!product.retail) return null;
  const unit = product.retail.unit;
  return <>
    {!query.data ? <LoadFeedback {...query} /> : <DataTable caption={"Lotes de " + product.name}
      columns={["Lote", "Vencimiento", "Existencia (" + unitLabels[unit] + ")", "Estado", ...(choose || actions ? ["Acción"] : [])]}
      rows={query.data.items.map((lot) => ({ id: lot.lot, cells: [
        lot.lot, lot.expiresOn ? dateLabel(lot.expiresOn) : "Sin fecha", quantityLabel(fromBase(lot.quantity, unit)),
        lot.held ? "Apartado" : lot.sellable ? "Vendible" : "Vencido",
        ...(actions ? [actions(lot)] : choose ? [<Button variant="secondary" onClick={() => choose(lot)}>Registrar pérdida</Button>] : []),
      ] }))} />}
    <Pages index={page} hasMore={query.data?.hasMore} onChange={setPage} />
  </>;
}

export function equivalence(amount: number, unit: string) {
  return quantityLabel(amount) + " " + (unit === "piece" && amount !== 1 ? "unidades" : baseUnit(unit));
}
