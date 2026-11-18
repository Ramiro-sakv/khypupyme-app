import { useState } from "react";
import { Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, SearchForm, useCommercialForm } from "./CommerceUi";
import { bob, editableMoney, parseMoney } from "./models";
import type { Customer, Page, Product } from "./models";
import { TimberStockTable } from "../timber/TimberFields";
import type { Dimensions, StockRow, TimberUnits } from "../timber/measures";
import { initialProductFields, ProductFields, productFieldsCommand, retailIndustry } from "../retail/ProductFields";
import { LotsTable, VariantMatrix } from "../retail/TradeFields";
import { fromBase, productAvailability, unitLabels } from "../retail/measures";
import type { Lot } from "../retail/measures";

export function CatalogPage({ units, industry, focus }: { units?: TimberUnits; industry?: string; focus?: string }) {
  const { showDocument } = useCommerce();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [loss, setLoss] = useState<{ product: Product; row?: StockRow; lot?: Lot }>();
  const [stock, setStock] = useState<Product>();
  const [filter, setFilter] = useState(focus ?? "");
  const data = useCommerceData<Page<Product>>("/products?" + new URLSearchParams({ page: String(page), search, ...(filter ? { attention: filter } : {}) }));

  return <div className="commerce-stack">
    <CommerceHeading title="Catálogo">
      <Button icon="plus" onClick={() => { setLoss(undefined); setStock(undefined); setEditing("new"); }}>Nuevo producto</Button>
    </CommerceHeading>
    {editing && <ProductEditor key={editing === "new" ? "new" : editing.id}
      product={editing === "new" ? undefined : editing} timberIndustry={units !== undefined} industry={industry} onClose={() => setEditing(null)} />}
    {loss && <LossEditor key={loss.product.id + (loss.lot?.lot ?? "")} product={loss.product} timber={loss.row?.timber} available={loss.row?.stock} lot={loss.lot}
      onClose={() => setLoss(undefined)} onDone={showDocument} />}
    {stock && units && <Card>
      <div className="page-heading"><div><h2>{stock.name}</h2><p>{stock.timber?.species} · {stock.code}</p></div>
        <Button variant="secondary" onClick={() => setStock(undefined)}>Cerrar existencias</Button></div>
      <TimberStockTable key={stock.id} product={stock} units={units} />
      {stock.active && <details><summary>Seleccionar medida para registrar una pérdida</summary>
        <TimberStockTable key={stock.id + ":loss"} product={stock} units={units} pick={(row) => setLoss({ product: stock, row })} />
      </details>}
    </Card>}
    {stock && (stock.apparel || stock.retail?.trackLots) && <Card>
      <div className="page-heading"><h2>{stock.apparel?.model ?? stock.name}</h2><Button variant="secondary" onClick={() => setStock(undefined)}>Cerrar existencias</Button></div>
      {stock.apparel && <VariantMatrix key={stock.apparel.model} model={stock.apparel.model} />}
      {stock.retail?.trackLots && <LotsTable key={stock.id} product={stock} choose={(lot) => setLoss({ product: stock, lot })} />}
    </Card>}
    <Card>
      {industry === "convenience" && <SelectField label="Ver existencias" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
        <option value="">Todo el catálogo</option><option value="reorder">Reposición</option><option value="expiring">Lotes que vencen en 30 días</option>
      </SelectField>}
      <SearchForm label={units ? "Buscar por producto, especie o código" : industry === "clothing" ? "Buscar por modelo o código" : "Buscar por producto o código"} onSearch={(value) => { setSearch(value); setPage(1); }} />
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords>Crea un producto para registrar sus compras y ventas.</NoRecords> :
        <DataTable caption="Existencias por producto" columns={["Producto", "Disponible", "Precio", "Valor de stock", "Acciones"]}
          rows={data.data.items.map((product) => ({ id: product.id, cells: [
            <span>{product.name}<small className="record-secondary">{product.timber?.species && product.timber.species + " · "}
              {product.code} · {product.active ? "Activo" : "Archivado"}</small>
              {product.apparel && <small className="record-secondary">{product.apparel.model} · {product.apparel.size} · {product.apparel.color}</small>}</span>,
            productAvailability(product), product.timber ? <div className="timber-rates">
              <span>1–2 pies · {bob(product.timber.superShortMinor)}</span>
              <span>3–6 pies · {bob(product.timber.shortMinor)}</span>
              <span>7–20 pies · {bob(product.timber.longMinor)}</span>
              <small>Por pie tablar</small>
            </div> : bob(product.priceMinor) + (product.retail ? " / " + unitLabels[product.retail.unit] : ""), bob(product.valueMinor),
            <div className="inline-actions">
              <Button variant="secondary" onClick={() => { setLoss(undefined); setStock(undefined); setEditing(product); }}>Editar</Button>
              {product.timber && units && <Button variant="secondary" onClick={() => { setEditing(null); setLoss(undefined); setStock(product); }}>Ver medidas</Button>}
              {(product.apparel || product.retail?.trackLots) && <Button variant="secondary" onClick={() => {
                setEditing(null); setLoss(undefined); setStock(product);
              }}>{product.apparel ? "Ver matriz" : "Ver lotes"}</Button>}
              {!product.timber && !product.equipment && !product.retail?.trackLots && (product.measuredStock ?? product.stock) > 0 &&
                <Button variant="plain" onClick={() => { setEditing(null); setStock(undefined); setLoss({ product }); }}>Registrar pérdida</Button>}
            </div>,
          ] }))} />}
      <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}

function ProductEditor({ product, timberIndustry, industry, onClose }: { product?: Product; timberIndustry: boolean; industry?: string; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [price, setPrice] = useState(product ? editableMoney(product.priceMinor) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const [timber, setTimber] = useState(product ? !!product.timber : timberIndustry);
  const [species, setSpecies] = useState(product?.timber?.species ?? "");
  const [setup, setSetup] = useState(() => initialProductFields(industry, product));
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
        return { kind: "product", entityId: product?.id, name, code, active, amountMinor, ...productFieldsCommand(setup) };
      }, onClose);
    }}>
    {timberIndustry && !product && <SelectField label="Tipo de producto" value={timber ? "timber" : "piece"}
      onChange={(event) => setTimber(event.target.value === "timber")}>
      <option value="timber">Madera por medidas</option><option value="piece">Producto por pieza</option>
    </SelectField>}
    <TextField label="Nombre del producto" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
    {timber && <TextField label="Especie" required maxLength={80} value={species} onChange={(event) => setSpecies(event.target.value)} />}
    <TextField label="Código" required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} />
    {retailIndustry(industry) && <ProductFields industry={industry} edits={!!product} fields={setup} setFields={setSetup} />}
    {timber ? ["Supercorta · 1–2 pies", "Corta · 3–6 pies", "Larga · 7–20 pies"].map((category, index) =>
      <TextField key={category} label={category + " (Bs por pie tablar)"} inputMode="decimal" required value={rates[index]}
        onChange={(event) => setRates(rates.map((rate, position) => position === index ? event.target.value : rate))} />) :
      <TextField label={setup.kind === "convenience" ? "Precio por " + unitLabels[setup.unit] + " (Bs)" : "Precio unitario (Bs)"}
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
      <SearchForm label="Buscar por nombre o teléfono" onSearch={(value) => { setSearch(value); setPage(1); }} />
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords>Los clientes registrados aparecerán aquí.</NoRecords> :
        <DataTable caption="Clientes registrados" columns={["Cliente", "Teléfono", "Acción"]}
          rows={data.data.items.map((customer) => ({ id: customer.id, cells: [
            customer.name, customer.phone || "—", <Button variant="secondary" onClick={() => setEditing(customer)}>Editar</Button>,
          ] }))} />}
      <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}
