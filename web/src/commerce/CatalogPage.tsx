import { useState } from "react";
import { InventoryDrawer } from "./InventoryDrawer";
import { OperationHeading } from "./OperationHeading";
import { Warehouse, StockMovements, WarehouseSerials } from "./Warehouse";
import { VariantBatch } from "../retail/VariantBatch";
import { Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, SearchForm, useCommercialForm } from "./CommerceUi";
import { bob, editableMoney, parseMoney } from "./models";
import type { Customer, Page, Product } from "./models";
import { TimberStockTable } from "../timber/TimberFields";
import type { Dimensions, StockRow, TimberUnits } from "../timber/measures";
import { initialProductFields, measuredIndustry, ProductFields, productFieldsCommand, retailIndustry } from "../retail/ProductFields";
import { LotsTable, VariantMatrix } from "../retail/TradeFields";
import { fromBase, productAvailability, unitLabels } from "../retail/measures";
import type { Lot } from "../retail/measures";
import { LotCorrection } from "../retail/LotCorrection";
import { CementOpening } from "../retail/CementOpening";
import { initialMaterials, MaterialFields, materialCommand } from "../retail/MaterialFields";
import { workNavigation } from "../services/work";
import { CompatibilityFilter, emptyVehicle, initialSpecialty, searchLabel, SpecialtyFields, specialtyCommand, SpecialtySummary, vehicleQuery } from "../retail/SpecialtyFields";

export function CatalogPage({ units, industry, focus, onStockIn, lotAlertDays = 30 }: {
  units?: TimberUnits; industry?: string; focus?: string; onStockIn?: () => void; lotAlertDays?: number;
}) {
  const { showDocument, readOnly, practice } = useCommerce();
  const hasWarehouse = !practice;
  const [catalog, setCatalog] = useState(focus === "catalog");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("true");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [variants, setVariants] = useState(false);
  const [loss, setLoss] = useState<{ product: Product; row?: StockRow; lot?: Lot }>();
  const [stock, setStock] = useState<Product>();
  const [opening, setOpening] = useState<Product>();
  const [correction, setCorrection] = useState<{ product: Product; lot: Lot }>();
  const [filter, setFilter] = useState(focus && ["reorder", "expiring", "expired", "held"].includes(focus) ? focus : "");
  const [vehicle, setVehicle] = useState(emptyVehicle);
  const data = useCommerceData<Page<Product>>(!hasWarehouse || catalog ? "/products?" + new URLSearchParams({ page: String(page), search,
    ...(status ? { active: status } : {}), ...(filter ? { attention: filter } : {}), ...(industry === "spareParts" ? vehicleQuery(vehicle) : {}) }) : null);

  const panelOpen = editing ?? (variants || loss || correction || opening || stock);
  function closePanel() {
    setEditing(null); setStock(undefined); setVariants(false); setLoss(undefined); setOpening(undefined); setCorrection(undefined);
  }

  return <div className="commerce-stack">
    <OperationHeading area="inventory" title="Inventario" description={units
      ? "Busca por especie y consulta las piezas disponibles por largo, espesor y ancho."
      : "Consulta existencias, precios y los movimientos que necesitan atención."}>
      <div className="inline-actions">
        {hasWarehouse && <div className="trade-controls" role="group" aria-label="Sección de inventario">
          <Button variant="secondary" aria-pressed={!catalog} onClick={() => setCatalog(false)}>Almacén</Button>
          <Button variant="secondary" aria-pressed={catalog} onClick={() => setCatalog(true)}>Catálogo</Button>
        </div>}
        {onStockIn && <Button variant="secondary" icon="parcel" onClick={onStockIn}>Entrada manual</Button>}
        {!readOnly && (industry === "clothing" || industry === "footwear") && <Button variant="secondary" icon="clothing" onClick={() => {
          setEditing(null); setStock(undefined); setLoss(undefined); setVariants(true);
        }}>Crear variantes juntas</Button>}
        {!readOnly && <Button icon="plus" onClick={() => { setVariants(false); setLoss(undefined); setStock(undefined); setEditing("new"); }}>Nuevo producto</Button>}
      </div>
    </OperationHeading>
    {panelOpen && <InventoryDrawer title={stock ? stock.name : "Gestión de productos"} onDismiss={closePanel}>
    {variants && <VariantBatch close={closePanel} automatic={industry === "clothing"} />}
    {editing && <ProductEditor key={editing === "new" ? "new" : editing.id}
      product={editing === "new" ? undefined : editing} timberIndustry={units !== undefined} industry={industry} onClose={() => setEditing(null)} />}
    {loss && <LossEditor key={loss.product.id + (loss.lot?.lot ?? "")} product={loss.product} timber={loss.row?.timber} available={loss.row?.stock} lot={loss.lot}
      onClose={() => setLoss(undefined)} onDone={showDocument} />}
    {correction && <LotCorrection key={correction.product.id + ":" + correction.lot.lot} product={correction.product} lot={correction.lot}
      close={() => setCorrection(undefined)} />}
    {opening && <CementOpening key={opening.id} product={opening} close={() => setOpening(undefined)} />}
    {stock?.timber && units && !loss && <Card>
      <div className="page-heading"><div><h2>{stock.name}</h2><p>{stock.timber?.species} · {stock.code}</p></div>
        <Button variant="secondary" onClick={() => setStock(undefined)}>Cerrar existencias</Button></div>
      <p>Total del producto · {stock.stock} piezas · {bob(stock.valueMinor)} a costo</p>
      <TimberStockTable key={stock.id} product={stock} units={units} detailed />
      {stock.active && !readOnly && <details><summary>Seleccionar medida para registrar una pérdida</summary>
        <TimberStockTable key={stock.id + ":loss"} product={stock} units={units} pick={(row) => setLoss({ product: stock, row })} />
      </details>}
    </Card>}
    {stock && !loss && !correction && (stock.apparel || stock.retail?.trackLots) && <Card>
      <div className="page-heading"><h2>{stock.apparel?.model ?? stock.name}</h2><Button variant="secondary" onClick={() => setStock(undefined)}>Cerrar existencias</Button></div>
      {stock.apparel && <VariantMatrix key={stock.apparel.model} model={stock.apparel.model} />}
      {stock.cosmetic?.afterOpeningMonths && <p>Duración tras apertura · {stock.cosmetic.afterOpeningMonths} meses</p>}
      {stock.retail?.trackLots && <LotsTable key={stock.id} product={stock}
        choose={!readOnly && stock.active && industry !== "cosmetics" && industry !== "convenience" ? (lot) => setLoss({ product: stock, lot }) : undefined}
        actions={!readOnly && stock.active && (industry === "cosmetics" || industry === "convenience") ? (lot) => <Button variant="secondary" onClick={() => setCorrection({ product: stock, lot })}>Gestionar lote</Button> : undefined} />}
    </Card>}
    {stock && !loss && !correction && hasWarehouse && <>
      {stock.equipment && <WarehouseSerials product={stock} />}
      <StockMovements key={stock.id} product={stock} units={units ?? "imperial"} />
    </>}
    </InventoryDrawer>}
    {hasWarehouse && !catalog ? <Warehouse industry={industry} focus={focus} open={setStock}
      openBags={!readOnly && industry === "cement" ? setOpening : undefined} /> :
    <Card className="inventory-table">
      <div className="inventory-toolbar"><h2>Productos y existencias</h2></div>
      <div className="inventory-controls">
      <SearchForm instant label={industry === "cosmetics" ? "Buscar por marca, presentación o tono" : searchLabel(industry)}
        onSearch={(value) => { setSearch(value); setPage(1); }} />
      <SelectField label="Estado del producto" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
        <option value="true">Activos</option><option value="false">Archivados</option><option value="">Todos</option>
      </SelectField>
      {measuredIndustry(industry) && <SelectField label="Ver existencias" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
        <option value="">Todo el catálogo</option><option value="reorder">Reposición</option><option value="expiring">Lotes que vencen en {lotAlertDays} días</option>
        {industry === "cosmetics" && <option value="held">Lotes apartados</option>}
      </SelectField>}
      </div>
      {industry === "spareParts" && <CompatibilityFilter onChange={(filter) => { setVehicle(filter); setPage(1); }} />}
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords>
        {search || filter || status === "false" ? "Cambia los filtros para ver otros productos." : "Crea un producto para registrar sus compras y ventas."}
      </NoRecords> :
        <DataTable caption="Existencias por producto" columns={["Producto", "Disponible", "Precio", "Valor de stock", "Acciones"]}
          rows={data.data.items.map((product) => ({ id: product.id, cells: [
            <div>{product.name}<small className="record-secondary">{product.timber?.species && product.timber.species + " · "}
              {product.code}{!product.active && " · Archivado"}</small>
              {product.apparel && <small className="record-secondary">{product.apparel.model} · {product.apparel.size} · {product.apparel.color}</small>}
              {product.cosmetic && <small className="record-secondary">{[product.cosmetic.brand, product.cosmetic.presentation, product.cosmetic.tone].filter(Boolean).join(" · ")}</small>}
              {product.cosmetic?.afterOpeningMonths && <small className="record-secondary">{product.cosmetic.afterOpeningMonths} meses tras apertura</small>}
              <SpecialtySummary product={product} />
              {industry === "spareParts" && !product.specialty?.parts && <small>Compatibilidad por confirmar</small>}</div>,
            <strong className="inventory-quantity">{productAvailability(product)}</strong>, product.timber ? <div className="timber-rates">
              <span>1–2 pies · {bob(product.timber.superShortMinor)}</span>
              <span>3–6 pies · {bob(product.timber.shortMinor)}</span>
              <span>7–20 pies · {bob(product.timber.longMinor)}</span>
              <small>Por pie tablar</small>
            </div> : bob(product.priceMinor) + (product.retail ? " / " + unitLabels[product.retail.unit] :
              product.specialty?.printing ? " / cara impresa" : product.specialty?.countUnit === "pair" ? " / par" : ""), bob(product.valueMinor),
            <div className="inline-actions">
              {!product.specialty?.material?.cement?.isBulk &&
                <Button variant="secondary" onClick={() => { setLoss(undefined); setStock(undefined); setEditing(product); }}>Editar</Button>}
              {product.active && product.specialty?.material?.cement?.bulkProductId &&
                <Button variant="secondary" onClick={() => { setEditing(null); setOpening(product); }}>Abrir bolsas</Button>}
              {product.timber && units && <Button variant="secondary" onClick={() => { setEditing(null); setLoss(undefined); setStock(product); }}>Ver medidas</Button>}
              {(product.apparel || product.retail?.trackLots) && <Button variant="secondary" onClick={() => {
                setEditing(null); setLoss(undefined); setStock(product);
              }}>{product.apparel ? "Ver matriz" : "Ver lotes"}</Button>}
              {!product.timber && !product.equipment && !product.retail?.trackLots && (product.measuredStock ?? product.stock) > 0 &&
                <Button variant="plain" onClick={() => { setEditing(null); setStock(undefined); setLoss({ product }); }}>Registrar pérdida</Button>}
            </div>,
          ] }))} />}
      <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
    </Card>}
  </div>;
}

function ProductEditor({ product, timberIndustry, industry, onClose }: { product?: Product; timberIndustry: boolean; industry?: string; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const autoCode = ["timber", "convenience", "clothing", "appliances"].includes(industry ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [price, setPrice] = useState(product ? editableMoney(product.priceMinor) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const [isService, setIsService] = useState(product?.isService ?? false);
  const [timber, setTimber] = useState(product ? !!product.timber : timberIndustry);
  const [species, setSpecies] = useState(product?.timber?.species ?? "");
  const [setup, setSetup] = useState(() => initialProductFields(industry, product));
  const [specialty, setSpecialty] = useState(() => initialSpecialty(product));
  const [materials, setMaterials] = useState(() => initialMaterials(product));
  const [rates, setRates] = useState((["superShortMinor", "shortMinor", "longMinor"] as const).map((key) => {
    const saved = product?.timber?.[key];
    return saved === undefined ? "" : editableMoney(saved);
  }));
  const form = useCommercialForm();
  return <OperationForm title={product ? "Editar producto" : "Nuevo producto"} onClose={onClose}
    error={form.error} blocked={form.blocked} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => {
        if (timber) {
          const [superShortMinor, shortMinor, longMinor] = rates.map(parseMoney);
          if (superShortMinor === null || shortMinor === null || longMinor === null)
            throw new Error("Indica las tres tarifas con hasta dos decimales.");
          return { kind: "product", entityId: product?.id, name, code, active,
            timberProduct: { species, superShortMinor, shortMinor, longMinor } };
        }
        const amountMinor = parseMoney(price);
        if (amountMinor === null) throw new Error("Escribe un precio con hasta dos decimales.");
        return { kind: "product", entityId: product?.id, name, code, active, amountMinor, serviceProduct: isService || undefined, ...productFieldsCommand(setup),
          ...specialtyCommand(industry, setup.kind === "stationery", specialty), ...materialCommand(industry, setup.kind, materials) };
      }, onClose);
    }}>
    {timberIndustry && !product && <SelectField label="Tipo de producto" value={timber ? "timber" : isService ? "service" : "piece"}
      onChange={(event) => { setTimber(event.target.value === "timber"); setIsService(event.target.value === "service"); }}>
      <option value="timber">Madera por medidas</option><option value="piece">Producto por pieza</option>
      <option value="service">Servicio de corte sin existencias</option>
    </SelectField>}
    {industry && workNavigation[industry] && <SelectField label="Tipo de ficha" value={isService ? "service" : "item"} disabled={!!product}
      onChange={(event) => setIsService(event.target.value === "service")}>
      <option value="item">Producto con existencias</option><option value="service">Servicio sin existencias</option>
    </SelectField>}
    <TextField label={isService ? "Nombre del servicio" : "Nombre del producto"} required maxLength={100} value={name}
      onChange={(event) => setName(event.target.value)} />
    {timber && <TextField label="Especie" required maxLength={80} value={species} onChange={(event) => setSpecies(event.target.value)} />}
    <TextField label="Código" required={!!product || !autoCode} maxLength={40} value={code}
      hint={!product && autoCode ? "Escanea el código del proveedor o deja el campo vacío para generarlo." : undefined} onChange={(event) => setCode(event.target.value)} />
    {retailIndustry(industry) && <ProductFields industry={industry} edits={!!product} fields={setup} setFields={setSetup} />}
    <SpecialtyFields industry={industry} printing={setup.kind === "stationery"} edits={!!product} fields={specialty} update={setSpecialty} />
    <MaterialFields industry={industry} kind={setup.kind} fields={materials} update={setMaterials} product={product} />
    {timber ? ["Supercorta · 1–2 pies", "Corta · 3–6 pies", "Larga · 7–20 pies"].map((category, index) =>
      <TextField key={category} label={category + " (Bs por pie tablar)"} inputMode="decimal" required value={rates[index]}
        onChange={(event) => setRates(rates.map((rate, position) => position === index ? event.target.value : rate))} />) :
      <TextField label={setup.kind === "stationery" ? "Precio por cara impresa (Bs)" : setup.kind === "footwear" ? "Precio por par (Bs)" :
        setup.kind === "cement" ? "Precio por bolsa (Bs)" : setup.kind === "ceramics" ? "Precio por pieza (Bs)" : isService ? "Tarifa del servicio (Bs)" :
        measuredIndustry(setup.kind) ? "Precio por " + unitLabels[setup.unit] + " (Bs)" : "Precio unitario (Bs)"}
        inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} />}
    {product && <SelectField label="Estado" value={active ? "active" : "archived"} onChange={(event) => setActive(event.target.value === "active")}>
      <option value="active">Activo</option><option value="archived">Archivado</option>
    </SelectField>}
  </OperationForm>;
}

function LossEditor({ product, timber, available, lot, onClose, onDone }: {
  product: Product; timber?: Dimensions; available?: number; lot?: Lot; onClose: () => void; onDone: (id: string) => void;
}) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const form = useCommercialForm();
  return <OperationForm title={"Registrar pérdida de " + product.name} onClose={onClose}
    error={form.error} blocked={form.blocked} action="Confirmar salida"
    onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "stock-loss", note, lines: [{ productId: product.id, quantity: product.retail ? 1 : Number(qty), timber,
        measure: product.retail ? { unit: product.retail.unit, quantity: qty.trim(), lot: lot?.lot } : undefined }] }),
        (result) => { onClose(); onDone(result.entityId); });
    }}>
    {lot && <p>Lote {lot.lot}</p>}
    <TextField label={product.retail ? "Cantidad perdida (" + unitLabels[product.retail.unit] + ")" : "Piezas perdidas"} type="number"
      min={product.retail && product.retail.unit !== "piece" ? 0.001 : 1}
      max={product.retail ? fromBase(lot?.quantity ?? product.measuredStock ?? 0, product.retail.unit) : available ?? product.stock}
      step={product.retail && product.retail.unit !== "piece" ? 0.001 : 1} required value={qty}
      onChange={(event) => setQty(event.target.value)} />
    <TextField label="Motivo" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}

export function CustomerEditor({ customer, onClose, onSaved }: {
  customer?: Customer; onClose: () => void; onSaved: (customer: Customer) => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const form = useCommercialForm();
  return <OperationForm title={customer ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}
    error={form.error} blocked={form.blocked} action="Guardar cliente" onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "customer", entityId: customer?.id, name, phone }),
        (result) => onSaved({ id: result.entityId, name: name.trim(), phone: phone.trim() }));
    }}>
    <TextField label="Nombre del cliente" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
    <TextField label="Teléfono (opcional)" type="tel" maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} />
  </OperationForm>;
}

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const data = useCommerceData<Page<Customer>>("/customers?" + new URLSearchParams({ search, page: String(page) }));

  return <div className="commerce-stack">
    <CommerceHeading title="Clientes"><Button icon="plus" onClick={() => setEditing("new")}>Nuevo cliente</Button></CommerceHeading>
    {editing && <CustomerEditor key={editing === "new" ? "new" : editing.id} customer={editing === "new" ? undefined : editing}
      onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
    <Card>
      <SearchForm label="Buscar por nombre, código o teléfono" onSearch={(value) => { setSearch(value); setPage(1); }} />
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords>Los clientes registrados aparecerán aquí.</NoRecords> :
        <DataTable caption="Clientes registrados" columns={["Cliente", "Código", "Teléfono", "Acción"]}
          rows={data.data.items.map((customer) => ({ id: customer.id, cells: [
            customer.name, customer.code ?? "—", customer.phone || "—", <Button variant="secondary" onClick={() => setEditing(customer)}>Editar</Button>,
          ] }))} />}
      <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}
