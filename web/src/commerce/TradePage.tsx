import { useEffect, useRef, useState } from "react";
import { get } from "../api/client";
import { Alert, Button, Card, DataTable, TextField } from "../ui/Primitives";
import { ReviewDock } from "../ui/ReviewDock";
import { CustomerEditor } from "./CatalogPage";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, Pages, PaymentField, SearchForm, useCommercialForm } from "./CommerceUi";
import { bob, editableMoney, moneyLimit, parseMoney } from "./models";
import type { CommandLine, Customer, EntryDocument, Page, Product } from "./models";
import { useDraft } from "./useDraft";
import { TimberFields } from "../timber/TimberFields";
import { timberRate, unitsOf } from "../timber/measures";
import type { Capture, Rates, TimberUnits } from "../timber/measures";
import { prepareTimber, stockKey, useTimberAvailability } from "../timber/trade";

export type TradeKind = "sale" | "purchase" | "quote";
type Line = { id: string; key?: string; name: string; quantity: string; priceMinor: number; cost: string; timber?: Capture; rates?: Rates };
type TradeDraft = {
  lines: Line[]; customer?: { id: string; name: string }; discount: string; note: string; method: string; quote?: string;
};
const emptyDraft: TradeDraft = { lines: [], discount: "0", method: "cash", note: "" };
const titles: Record<TradeKind, string> = { sale: "Venta nueva", purchase: "Compra nueva", quote: "Cotización nueva" };
const label: Record<TradeKind, string> = { sale: "venta", purchase: "compra", quote: "cotización" };

export function TradePage({ kind, proposal, dismissProposal, onHistory, units = "imperial" }: {
  kind: TradeKind; proposal?: EntryDocument; dismissProposal: () => void; onHistory: () => void; units?: TimberUnits;
}) {
  const workspace = useCommerce();
  const draftKey = workspace.scope + ":" + kind;
  const { value, update, ready, error, flush, reload } = useDraft(draftKey, emptyDraft);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [acknowledged, setAcknowledged] = useState("");
  const cart = useRef<HTMLHeadingElement>(null);
  const products = useCommerceData<Page<Product>>("/products?" + new URLSearchParams({ active: "true", search, page: String(page) }));
  const current = useCurrentProducts([...new Set(value.lines.map((line) => line.id))].join(","));
  const form = useCommercialForm();
  const confirmation = workspace.confirmation;
  const frozen = form.processing || workspace.pending?.draft?.key === draftKey;
  const isPurchase = kind === "purchase";
  const quote = kind === "quote";

  useEffect(() => {
    if (confirmation?.draft?.key === draftKey) void reload();
  }, [confirmation, draftKey, reload]);

  const discount = isPurchase ? 0 : parseMoney(value.discount);
  const timberLines = value.lines.flatMap((line) => line.timber ? [{ ...line, timber: line.timber }] : []);
  const timber = prepareTimber(timberLines, current.data, isPurchase);
  const availability = useTimberAvailability(timber.commands, !isPurchase);
  const shortageByMeasure = !!availability.stock && timber.commands.some((line) =>
    line.quantity > (availability.stock?.[stockKey(line.productId, line.timber)] ?? 0));
  const lines = value.lines.filter((line) => !line.timber).map((line) => {
    const product = current.data?.[line.id];
    const quantity = Number(line.quantity);
    const validQuantity = /^\d+$/.test(line.quantity) && quantity >= 1 && quantity <= 1_000_000;
    const unitMinor = isPurchase ? parseMoney(line.cost) : line.priceMinor;
    const subtotal = validQuantity && unitMinor !== null && quantity * unitMinor <= moneyLimit ? quantity * unitMinor : null;
    return {
      line, product, quantity, unitMinor, subtotal,
      shortage: product !== undefined && validQuantity && quantity > product.stock,
      changed: !isPurchase && product !== undefined && product.priceMinor !== line.priceMinor,
    };
  });
  const gross = lines.reduce((sum, item) => sum + (item.subtotal ?? 0), timber.gross);
  const distinctGroups = new Set(timber.commands.map((row) => [row.productId, row.timber.lengthMicros, row.timber.thicknessMicros].join(":")));
  const limitReached = distinctGroups.size + lines.length > 20 || timber.commands.length + lines.length > 100;
  const total = value.lines.length > 0 && lines.every((item) => item.subtotal !== null) && timber.groups.every((group) => group.total !== null) &&
    !limitReached && !timber.problem &&
    gross <= moneyLimit && discount !== null && discount <= gross ? gross - discount : null;
  const unavailable = !current.data || lines.some(({ product, changed, shortage }) =>
    !product?.active || changed || (kind === "sale" && shortage)) ||
    timberLines.some((line) => !current.data?.[line.id]?.active || !current.data[line.id].timber) ||
    (kind === "sale" && timberLines.length > 0 && (!availability.stock || shortageByMeasure));
  const requiresCustomer = kind === "sale" && value.method === "credit" && (!value.customer || total === 0);
  const reviewKey = JSON.stringify([value.lines, value.discount, value.method, value.customer?.id, value.quote, total, timber.commands]);
  const canSend = total !== null && !unavailable && !requiresCustomer && !error && acknowledged === reviewKey;
  const totalText = total === null ? "Pendiente" : bob(total);

  function add(product: Product) {
    update((currentDraft) => {
      if (product.timber) {
        if (currentDraft.lines.length >= 100) return currentDraft;
        return { ...currentDraft, lines: [...currentDraft.lines, { id: product.id, key: crypto.randomUUID(),
          name: product.name, quantity: "", priceMinor: product.priceMinor, cost: "", rates: product.timber,
          timber: { units, length: "", thickness: "", widths: "" } }] };
      }
      const existing = currentDraft.lines.find((line) => line.id === product.id);
      if (existing) return {
        ...currentDraft, lines: currentDraft.lines.map((line) => line.id === product.id
          ? { ...line, quantity: String(Math.min(1_000_000, (Number(line.quantity) || 0) + 1)) } : line),
      };
      if (currentDraft.lines.filter((line) => !line.timber).length >= 20) return currentDraft;
      return { ...currentDraft, lines: [...currentDraft.lines, { id: product.id, name: product.name,
        quantity: "1", priceMinor: product.priceMinor, cost: "" }] };
    });
  }

  function edit(id: string, fields: Partial<Line>) {
    update((draft) => ({ ...draft, lines: draft.lines.map((line) => (line.key ?? line.id) === id ? { ...line, ...fields } : line) }));
  }
  function remove(id: string) {
    update((draft) => ({ ...draft, lines: draft.lines.filter((line) => (line.key ?? line.id) !== id) }));
  }

  if (!ready) return <><CommerceHeading title={titles[kind]} /><LoadFeedback error={error || undefined} reload={() => void reload()} /></>;

  return <div className="commerce-stack">
    <CommerceHeading title={titles[kind]}>
      <Button variant="secondary" icon="document" onClick={onHistory}>Ver operaciones</Button>
    </CommerceHeading>
    {quote && <Alert>La cotización tiene siete días de vigencia. Al convertirla, la venta verifica precio y existencias.</Alert>}
    {error && <Alert tone="error">{error}<br /><Button variant="secondary" onClick={() => void reload()}>Cargar borrador guardado</Button></Alert>}
    {proposal && !frozen && <Card>
      <h2>Cotización {proposal.number}</h2>
      <p>{value.lines.length ? "Cargar esta cotización reemplazará los artículos del borrador de venta." : "Carga los artículos para revisar y cobrar la venta."}</p>
      <div className="inline-actions commerce-top">
        <Button variant="secondary" onClick={dismissProposal}>Omitir</Button>
        <Button onClick={() => {
          update(() => ({ ...emptyDraft, quote: proposal.id, note: proposal.note, discount: editableMoney(proposal.discountMinor),
            customer: proposal.customerId && proposal.customerName ? { id: proposal.customerId, name: proposal.customerName } : undefined,
            lines: proposal.lines.map((line) => ({ id: line.productId, name: line.name, quantity: String(line.quantity),
              priceMinor: line.unitMinor, cost: "", key: line.timber ? line.lineId : undefined,
              rates: line.timber ? { species: line.species ?? "", superShortMinor: line.unitMinor, shortMinor: line.unitMinor, longMinor: line.unitMinor } : undefined,
              timber: line.timber ? { units: unitsOf(proposal.timberUnits), length: "", thickness: "", widths: "",
                selection: { timber: line.timber, quantity: String(line.quantity) } } : undefined })) }));
          dismissProposal();
        }}>Cargar cotización</Button>
      </div>
    </Card>}
    <div className="trade-split">
      <Card>
        <h2>Productos</h2>
        <SearchForm label="Buscar por nombre, especie o código" onSearch={(query) => { setSearch(query); setPage(1); }} />
        {!products.data ? <LoadFeedback {...products} /> : products.data.items.length === 0 ? <NoRecords>Consulta el catálogo para dar de alta artículos.</NoRecords> :
          <ul className="trade-products">
            {products.data.items.map((product) => <li key={product.id}>
              <button type="button" className="trade-product" disabled={frozen || (product.timber ? value.lines.length >= 100 :
                lines.length >= 20 && !lines.some((item) => item.line.id === product.id))}
                onClick={() => add(product)}>
                <strong>{product.name}</strong><span>{product.timber?.species && product.timber.species + " · "}{product.code}</span>
                <span>{product.stock} disp.{product.timber ? " por medidas" : " · " + bob(product.priceMinor)}</span>
              </button>
            </li>)}
          </ul>}
        <Pages index={page} hasMore={products.data?.hasMore} onChange={setPage} />
      </Card>
      <Card>
        <div className="page-heading">
          <h2 ref={cart} tabIndex={-1}>Carrito</h2>
          <strong className="trade-total" aria-live="polite">Total de {label[kind]} · {totalText}</strong>
        </div>
        {value.quote && <div className="inline-actions">
          <p>Venta vinculada a cotización</p>
          <Button variant="plain" disabled={frozen} onClick={() => update((draft) => ({ ...draft, quote: undefined }))}>Quitar vínculo</Button>
        </div>}
        {value.lines.length === 0 && <NoRecords>Elige un producto para iniciar el borrador.</NoRecords>}
        {lines.length > 0 &&
          <DataTable caption="Líneas del borrador" columns={["Producto", "Piezas", isPurchase ? "Costo unitario" : "Precio unitario", "Subtotal", "Acción"]}
            rows={lines.map(({ line, product, changed, shortage, unitMinor, subtotal, quantity }) => ({ id: line.id, cells: [
              <div>{product?.name ?? line.name}
                {product && kind !== "purchase" && <small className="record-secondary">Pedido {Number.isFinite(quantity) ? quantity : "—"} · Disponible {product.stock}
                  {shortage ? " · Faltan " + (quantity - product.stock) : ""}</small>}
                {product && !product.active && <small className="trade-issue">Producto archivado</small>}
              </div>,
              <TextField label={"Piezas de " + line.name} type="number" min={1} max={1_000_000} step={1} value={line.quantity}
                disabled={frozen} onChange={(event) => edit(line.id, { quantity: event.target.value })} />,
              isPurchase ? <TextField label={"Costo de " + line.name} inputMode="decimal" value={line.cost} disabled={frozen}
                onChange={(event) => edit(line.id, { cost: event.target.value })} /> :
                <div>{unitMinor !== null && bob(unitMinor)}
                  {changed && product && <Button variant="plain" disabled={frozen}
                    onClick={() => edit(line.id, { priceMinor: product.priceMinor })}>Usar precio actualizado</Button>}</div>,
              subtotal === null ? "Pendiente" : bob(subtotal),
              <Button variant="plain" aria-label={"Quitar " + line.name} disabled={frozen}
                onClick={() => remove(line.id)}>Quitar</Button>,
            ] }))} />}
        {timberLines.map((line, index) => {
          const group = timber.groups[index];
          const key = line.key ?? line.id;
          const currentRates = current.data?.[line.id]?.timber;
          const appliedRates = line.rates ?? currentRates;
          const changed = !isPurchase && currentRates && group.rows.some((row) => row.charged !== timberRate(currentRates, row.timber));
          return <div key={key} className="timber-trade">
            {!isPurchase && group.rows[0] && <p>Tarifa aplicada · {bob(group.rows[0].charged)} por pie tablar</p>}
            {changed && <Button variant="secondary" disabled={frozen} onClick={() => edit(key, { rates: currentRates })}>Usar tarifa actualizada</Button>}
            <TimberFields name={line.name} species={appliedRates?.species ?? ""} productId={line.id} capture={line.timber}
              cost={line.cost} onChange={(capture) => edit(key, { timber: capture })} onCost={(cost) => edit(key, { cost })} onRemove={() => remove(key)}
              disabled={frozen} purchase={isPurchase} rows={group.rows.map((row) => {
                const id = stockKey(line.id, row.timber);
                return { ...row, requested: timber.requested.get(id)?.quantity ?? row.quantity,
                  available: availability.stock ? availability.stock[id] ?? 0 : undefined };
              })} notices={group.notices} error={group.error} total={group.total} />
          </div>;
        })}
        {value.lines.length > 0 && <p>Borrador local · {lines.length + distinctGroups.size} de 20 grupos · {lines.length + timber.commands.length} de 100 líneas</p>}
        {limitReached && <Alert tone="error">Divide la operación en hasta 20 grupos y 100 líneas.</Alert>}
        {timber.problem && <Alert tone="error">{timber.problem}</Alert>}
        {availability.loading && <p role="status">Consultando existencias por medida…</p>}
        {availability.error && <Alert tone="error">{availability.error} <Button variant="secondary" onClick={availability.retry}>Reintentar medidas</Button></Alert>}
        {current.error && <Alert tone="error">{current.error} <Button variant="secondary" onClick={current.reload}>Reintentar disponibilidad</Button></Alert>}
      </Card>
    </div>
    {value.lines.length > 0 && <ReviewDock cartFocus={cart} total={totalText}>
      {!isPurchase && <Buyer selected={value.customer} disabled={frozen}
        onChange={(customer) => update((draft) => ({ ...draft, customer }))} />}
      <form className="account-form" onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        void form.submit(() => ({
          kind, method: quote ? undefined : value.method,
          customerId: isPurchase ? undefined : value.customer?.id,
          discountMinor: discount ?? undefined, sourceId: value.quote, note: value.note,
          lines: [...lines.map(({ line, quantity, unitMinor }): CommandLine => ({ productId: line.id, quantity, unitMinor })), ...timber.commands],
        }), (result) => workspace.showDocument(result.entityId), flush);
      }}>
        {!isPurchase && <TextField label="Descuento total (Bs)" inputMode="decimal" value={value.discount} disabled={frozen}
          onChange={(event) => update((draft) => ({ ...draft, discount: event.target.value }))} />}
        {!quote && <PaymentField value={value.method} credit={kind === "sale"} disabled={frozen}
          onChange={(method) => { if (!frozen) update((draft) => ({ ...draft, method })); }} />}
        <TextField label="Referencia (opcional)" maxLength={240} value={value.note} disabled={frozen}
          onChange={(event) => update((draft) => ({ ...draft, note: event.target.value }))} />
        {total === null && <Alert>Revisa las cantidades, importes y el descuento antes de confirmar.</Alert>}
        {unavailable && <Alert>Verifica disponibilidad y precios de las líneas en el carrito.</Alert>}
        {quote && shortageByMeasure && <Alert>Hay medidas con faltantes. Se volverán a verificar al convertir la cotización en venta.</Alert>}
        {requiresCustomer && <Alert>El fiado requiere un cliente registrado y un importe positivo.</Alert>}
        {form.error && <Alert tone="error">{form.error}</Alert>}
        <label className="trade-check">
          <input type="checkbox" checked={acknowledged === reviewKey} disabled={frozen || total === null}
            onChange={(event) => setAcknowledged(event.target.checked ? reviewKey : "")} />
          He revisado el importe de {totalText}
        </label>
        <Button type="submit" icon="check" disabled={!canSend || form.blocked}>Confirmar {label[kind]}</Button>
      </form>
    </ReviewDock>}
  </div>;
}

function Buyer({ selected, disabled, onChange }: {
  selected?: TradeDraft["customer"]; disabled: boolean; onChange: (customer: TradeDraft["customer"]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useCommerceData<Page<Customer>>("/customers?" + new URLSearchParams({ search, page: String(page) }));
  return <div className="buyer">
    <div className="page-heading">
      <strong>{selected?.name ?? "Cliente ocasional"}</strong>
      <Button variant="secondary" icon="plus" disabled={disabled} onClick={() => setEditing(!editing)}>Nuevo cliente</Button>
    </div>
    {editing && <CustomerEditor onClose={() => setEditing(false)} onSaved={(customer) => {
      onChange({ id: customer.id, name: customer.name }); setEditing(false);
    }} />}
    <details><summary>Elegir cliente registrado</summary>
      <SearchForm label="Buscar cliente" onSearch={(query) => { setSearch(query); setPage(1); }} />
      <Button variant="plain" disabled={disabled} onClick={() => onChange(undefined)}>Cliente ocasional</Button>
      {!data && <LoadFeedback error={error} reload={reload} />}
      {data?.items.length === 0 && <p>Sin clientes en esta búsqueda.</p>}
      <div className="buyer-options">{data?.items.map((customer) => <Button key={customer.id} variant="secondary" disabled={disabled}
        onClick={() => onChange({ id: customer.id, name: customer.name })}>{customer.name}</Button>)}</div>
      <Pages index={page} hasMore={data?.hasMore} onChange={setPage} />
    </details>
  </div>;
}

function useCurrentProducts(ids: string) {
  const { path, revision } = useCommerce();
  const [refresh, setRefresh] = useState(0);
  const key = [ids, revision, refresh].join("@");
  const [state, setState] = useState<{ key: string; data?: Record<string, Product>; error?: string }>();
  useEffect(() => {
    if (!ids) return;
    const abort = new AbortController();
    void Promise.all(ids.split(",").map(async (id) => [id, await get<Product>(path + "/products/" + id, abort.signal)] as const))
      .then((rows) => { if (!abort.signal.aborted) setState({ key, data: Object.fromEntries(rows) }); })
      .catch((error: unknown) => { if (!abort.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "No se pudo verificar existencias." }); });
    return () => abort.abort();
  }, [ids, key, path]);
  return { ...(state?.key === key ? state : {}), reload: () => setRefresh((previous) => previous + 1) };
}
