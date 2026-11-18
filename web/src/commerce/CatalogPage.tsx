import { useState } from "react";
import { Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, SearchForm, useCommercialForm } from "./CommerceUi";
import { bob, editableMoney, parseMoney } from "./models";
import type { Customer, Page, Product } from "./models";

export function CatalogPage() {
  const { showDocument } = useCommerce();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [loss, setLoss] = useState<Product>();
  const data = useCommerceData<Page<Product>>("/products?" + new URLSearchParams({ page: String(page), search }));

  return <div className="commerce-stack">
    <CommerceHeading title="Catálogo">
      <Button icon="plus" onClick={() => { setLoss(undefined); setEditing("new"); }}>Nuevo producto</Button>
    </CommerceHeading>
    {editing && <ProductEditor key={editing === "new" ? "new" : editing.id}
      product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    {loss && <LossEditor key={loss.id} product={loss} onClose={() => setLoss(undefined)} onDone={showDocument} />}
    <Card>
      <SearchForm label="Buscar por producto o código" onSearch={(value) => { setSearch(value); setPage(1); }} />
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords>Crea un producto para registrar sus compras y ventas.</NoRecords> :
        <DataTable caption="Existencias por producto" columns={["Producto", "Piezas", "Precio", "Valor de stock", "Acciones"]}
          rows={data.data.items.map((product) => ({ id: product.id, cells: [
            <span>{product.name}<small className="record-secondary">{product.code} · {product.active ? "Activo" : "Archivado"}</small></span>,
            product.stock, bob(product.priceMinor), bob(product.valueMinor),
            <div className="inline-actions">
              <Button variant="secondary" onClick={() => { setLoss(undefined); setEditing(product); }}>Editar</Button>
              {product.stock > 0 && <Button variant="plain" onClick={() => { setEditing(null); setLoss(product); }}>Registrar pérdida</Button>}
            </div>,
          ] }))} />}
      <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
    </Card>
  </div>;
}

function ProductEditor({ product, onClose }: { product?: Product; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [price, setPrice] = useState(product ? editableMoney(product.priceMinor) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const form = useCommercialForm();
  return <OperationForm title={product ? "Editar producto" : "Nuevo producto"} onClose={onClose}
    error={form.error} blocked={form.blocked} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => {
        const amountMinor = parseMoney(price);
        if (amountMinor === null) throw new Error("Escribe un precio con hasta dos decimales.");
        return { kind: "product", entityId: product?.id, name, code, active, amountMinor };
      }, onClose);
    }}>
    <TextField label="Nombre del producto" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
    <TextField label="Código" required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} />
    <TextField label="Precio unitario (Bs)" inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} />
    {product && <SelectField label="Estado" value={active ? "active" : "archived"} onChange={(event) => setActive(event.target.value === "active")}>
      <option value="active">Activo</option><option value="archived">Archivado</option>
    </SelectField>}
  </OperationForm>;
}

function LossEditor({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (id: string) => void }) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const form = useCommercialForm();
  return <OperationForm title={"Registrar pérdida de " + product.name} onClose={onClose}
    error={form.error} blocked={form.blocked} action="Confirmar salida"
    onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "stock-loss", note, lines: [{ productId: product.id, quantity: Number(qty) }] }),
        (result) => { onClose(); onDone(result.entityId); });
    }}>
    <TextField label="Piezas perdidas" type="number" min={1} max={product.stock} step={1} required value={qty}
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
