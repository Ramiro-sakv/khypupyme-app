import { useState } from "react";
import type { components } from "../api/schema";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { CommerceHeading, LoadFeedback, OperationForm, Pages, SearchForm, useCommercialForm } from "../commerce/CommerceUi";
import type { Customer, Page } from "../commerce/models";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";

type Schema = components["schemas"];
type ContainerInfo = Schema["ContainerInfo"];
type ContainerInput = Schema["ContainerInput"];
type ContainerObligation = Schema["ContainerObligation"];
export type ContainerDraft = Record<string, { delivered: string; returned: string }>;
const empty = { delivered: "", returned: "" };

export function useContainerBalances(enabled: boolean, customer?: string) {
  return useCommerceData<ContainerInfo[]>(enabled ? "/containers" +
    (customer ? "?" + new URLSearchParams({ customer }) : "") : null);
}

export function prepareContainerMoves(draft: ContainerDraft, rows: ContainerInfo[] | undefined, customer?: string) {
  const moves: ContainerInput[] = [];
  for (const [typeId, amount] of Object.entries(draft)) {
    const values = [amount.delivered.trim(), amount.returned.trim()];
    if (values.some((value) => value !== "" && (!/^\d{1,7}$/.test(value) || Number(value) > 1_000_000)))
      return { moves, error: "Indica cantidades enteras de envases, entre 0 y 1.000.000." };
    const [delivered, returned] = values.map(Number);
    if (delivered === 0 && returned === 0) continue;
    if (!customer) return { moves, error: "Elige un cliente registrado para estos envases." };
    if (!rows) return { moves, error: "Consulta el saldo del cliente antes de confirmar." };
    const row = rows.find((item) => item.typeId === typeId);
    if (!row) return { moves, error: "Ese tipo de envase ya no está disponible." };
    if (returned > row.customerBalance)
      return { moves, error: row.name + ": el cliente tenía " + row.customerBalance + " y quieres devolver " + returned + "." };
    if (delivered > row.available + returned)
      return { moves, error: row.name + ": quedan " + (row.available + returned) + " disponibles tras las devoluciones." };
    moves.push({ typeId, delivered, returned });
  }
  return { moves, error: moves.length > 20 ? "Divide el registro en hasta 20 tipos de envases." : "" };
}

export function ContainerFields({ balances, draft, update, disabled, customer }: {
  balances: ReturnType<typeof useContainerBalances>; draft: ContainerDraft; update: (value: ContainerDraft) => void;
  disabled: boolean; customer?: string;
}) {
  if (!customer) return <p>Elige un cliente registrado para entregar o recibir envases.</p>;
  if (!balances.data) return <LoadFeedback {...balances} />;
  if (!balances.data.length) return <p>Registra primero los tipos de envase desde Envases.</p>;
  return <div className="commerce-stack">
    {balances.data.map((row) => {
      const amount = draft[row.typeId] ?? empty;
      const final = row.customerBalance - Number(amount.returned) + Number(amount.delivered);
      return <div key={row.typeId} className="container-row">
        <strong>{row.name}</strong>
        <p>{row.available} disponibles · saldo previo del cliente {row.customerBalance}</p>
        <div className="store-fields">
          <TextField label={"Entregados de " + row.name} inputMode="numeric" value={amount.delivered} disabled={disabled}
            onChange={(event) => update({ ...draft, [row.typeId]: { ...amount, delivered: event.target.value } })} />
          <TextField label={"Devueltos de " + row.name} inputMode="numeric" value={amount.returned} disabled={disabled}
            onChange={(event) => update({ ...draft, [row.typeId]: { ...amount, returned: event.target.value } })} />
        </div>
        {Number.isInteger(final) && final >= 0 && Number(amount.returned) <= row.customerBalance && <small>Saldo del cliente después del movimiento · {final}</small>}
      </div>;
    })}
  </div>;
}

export function ContainersPage({ initial }: { initial?: string }) {
  const { showDocument } = useCommerce();
  const [setup, setSetup] = useState<ContainerInfo | "new">();
  const [customer, setCustomer] = useState<{ id: string; name: string }>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<ContainerDraft>({});
  const balances = useContainerBalances(true, customer?.id);
  const clients = useCommerceData<Page<Customer>>("/customers?" + new URLSearchParams({ search, page: String(page) }));
  const pending = prepareContainerMoves(draft, balances.data, customer?.id);
  const [openObligations, setOpenObligations] = useState(initial === "pending");
  const form = useCommercialForm();

  return <div className="commerce-stack">
    <CommerceHeading title="Envases retornables"><Button icon="plus" onClick={() => setSetup("new")}>Nuevo tipo de envase</Button></CommerceHeading>
    {setup && <ContainerStock key={setup === "new" ? "new" : setup.typeId} type={setup === "new" ? undefined : setup} close={() => setSetup(undefined)} />}
    <Card>
      {balances.data ? <DataTable caption="Existencias de envases" columns={["Envase", "Disponibles", "Prestados", "Saldo del cliente", "Acción"]}
        rows={balances.data.map((row) => ({ id: row.typeId, cells: [row.name, row.available, row.borrowed, customer ? row.customerBalance : "—",
          <Button variant="secondary" onClick={() => setSetup(row)}>Añadir existencias</Button>] }))} /> : <LoadFeedback {...balances} />}
    </Card>
    <Card>
      <div className="page-heading">
        <h2>Envases pendientes por cliente</h2>
        <Button variant="secondary" aria-expanded={openObligations} onClick={() => setOpenObligations(!openObligations)}>
          {openObligations ? "Ocultar pendientes" : "Ver pendientes"}
        </Button>
      </div>
      {openObligations && <ContainerObligations onSelect={(id, name) => {
        setCustomer({ id, name });
        setDraft({});
        document.getElementById("container-movement-client")?.focus();
      }} />}
    </Card>
    <Card>
      <SearchForm label="Buscar cliente por nombre o teléfono" onSearch={(value) => { setSearch(value); setPage(1); }} />
      <SelectField id="container-movement-client" label="Cliente del movimiento" value={customer?.id ?? ""} onChange={(event) => {
        const found = clients.data?.items.find((row) => row.id === event.target.value);
        setCustomer(found ? { id: found.id, name: found.name } : undefined); setDraft({});
      }}>
        <option value="">Selecciona un cliente</option>
        {customer && !clients.data?.items.some((row) => row.id === customer.id) && <option value={customer.id}>{customer.name}</option>}
        {clients.data?.items.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
      </SelectField>
      {!clients.data && <LoadFeedback {...clients} />}
      {clients.data?.items.length === 0 && <p>Crea un cliente desde Clientes para registrar un préstamo o devolución.</p>}
      <Pages index={page} hasMore={clients.data?.hasMore} onChange={setPage} />
    </Card>
    <OperationForm title="Movimiento de envases sin venta" action="Confirmar movimiento" blocked={form.blocked || !!pending.error || !pending.moves.length}
      error={form.error || pending.error} onSubmit={(event) => {
        event.preventDefault();
        if (pending.error || !pending.moves.length) return;
        void form.submit(() => ({ kind: "containers", customerId: customer?.id, containers: pending.moves }), (result) => showDocument(result.entityId));
      }}>
      <Alert>Este movimiento cambia las cantidades de envases y el saldo del cliente.</Alert>
      <ContainerFields balances={balances} draft={draft} update={setDraft} disabled={form.blocked} customer={customer?.id} />
    </OperationForm>
  </div>;
}

function ContainerObligations({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const result = useCommerceData<Page<ContainerObligation>>("/container-obligations?" + new URLSearchParams({ search, page: String(page) }));
  return <>
    <SearchForm label="Buscar pendientes por cliente" onSearch={(value) => { setSearch(value); setPage(1); }} />
    {!result.data ? <LoadFeedback {...result} /> : !result.data.items.length ? <p>No hay envases pendientes para esa búsqueda.</p> :
      <DataTable caption="Préstamos pendientes" columns={["Cliente", "Envase", "Cantidad por devolver", "Acción"]}
        rows={result.data.items.map((row) => ({ id: row.customerId + ":" + row.typeId, cells: [
          row.customerName, row.containerName, row.quantity,
          <Button variant="secondary" onClick={() => onSelect(row.customerId, row.customerName)}>Registrar devolución</Button>,
        ] }))} />}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </>;
}

function ContainerStock({ type, close }: { type?: ContainerInfo; close: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const form = useCommercialForm();
  return <OperationForm title={type ? "Entrada de " + type.name : "Nuevo tipo de envase"} onClose={close} error={form.error} blocked={form.blocked}
    onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "container-stock", entityId: type?.typeId, name: type ? undefined : name, stockQuantity: Number(quantity) }), close);
    }}>
    {!type && <TextField label="Nombre del envase" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />}
    <TextField label="Cantidad que ingresa" type="number" min={1} max={1_000_000} step={1} required value={quantity}
      onChange={(event) => setQuantity(event.target.value)} />
  </OperationForm>;
}
