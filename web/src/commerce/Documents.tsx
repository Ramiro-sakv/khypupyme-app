import { lazy, useState } from "react";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, PaymentField, useCommercialForm } from "./CommerceUi";
import { bob, dateLabel, documentAmount, documentName, isOperationalReceipt, methodLabel } from "./models";
import type { EntryDocument, EntryInfo, Page } from "./models";
import { documentTimber, documentUnit } from "../timber/measures";
import { describeLine, lineQuantity, lineRate, remainingQuantity, returnUnit, unitLabels } from "../retail/measures";
import { ExchangeEditor } from "../retail/ExchangeEditor";
import { ExportRecords } from "./ExportRecords";

const DeliveryPanel = lazy(() => import("../retail/FurnitureDeliveries").then((page) => ({ default: page.DeliveryPanel })));

const historyKinds = ["sale", "purchase", "quote", "return", "expense", "void-expense", "cash-adjust", "stock-in", "manual-debt", "void-debt",
  "stock-loss", "open-cash", "close-cash", "collect", "exchange", "inspection",
  "containers", "container-stock", "hold-lot", "release-lot", "discard-lot", "open-cement", "repair-receipt", "work-receipt", "delivery-receipt", "warranty", "prepare-delivery", "cancel-delivery"];
const documentKinds = ["sale", "purchase", "quote", "return", "exchange", "collect", "close-cash", "repair-receipt", "work-receipt", "delivery-receipt",
  "cash-adjust", "stock-in", "manual-debt", "void-debt", "warranty", "prepare-delivery", "cancel-delivery"];
type EntryFilters = { from: string; to: string; search: string };
const emptyFilters: EntryFilters = { from: "", to: "", search: "" };

export function HistoryPage({ initialKind, allowExport, documents = false, fixedTitle }: {
  initialKind: string; allowExport: boolean; documents?: boolean; fixedTitle?: string;
}) {
  const [kind, setKind] = useState(initialKind);
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const effectiveKind = kind || (documents ? "documents" : "");
  return <div className="commerce-stack">
    {fixedTitle ? <h2>{fixedTitle}</h2> :
      <CommerceHeading title={documents ? "Documentos" : "Historial"}>{allowExport && <ExportRecords />}</CommerceHeading>}
    <Card className="history-filter">
      <form className="history-toolbar" onSubmit={(event) => {
        event.preventDefault();
        setFilters({ ...draft, search: draft.search.trim() });
      }}>
        {!fixedTitle && <SelectField label="Tipo de operación" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">Todas</option>
          {(documents ? documentKinds : historyKinds).map((value) => <option key={value} value={value}>{documentName(value)}</option>)}
        </SelectField>}
        <TextField label="Desde" type="date" value={draft.from} max={draft.to || undefined}
          onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        <TextField label="Hasta" type="date" value={draft.to} min={draft.from || undefined}
          onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        <TextField label="Número, cliente o referencia" value={draft.search} maxLength={80}
          onChange={(event) => setDraft({ ...draft, search: event.target.value })} />
        <Button type="submit" icon="search">Buscar</Button>
      </form>
    </Card>
    <EntryList key={JSON.stringify([effectiveKind, filters])} kind={effectiveKind} filters={filters}
      caption={documents ? "Comprobantes disponibles" : "Operaciones confirmadas"} />
  </div>;
}

export function EntryList({ kind, cashSession, caption, filters }: {
  kind?: string; cashSession?: string; caption: string; filters?: EntryFilters;
}) {
  const [page, setPage] = useState(1);
  const { showDocument } = useCommerce();
  const query = new URLSearchParams({ page: String(page) });
  if (kind) query.set("kind", kind);
  if (cashSession) query.set("cashSession", cashSession);
  if (filters) for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  const data = useCommerceData<Page<EntryInfo>>("/history?" + query);
  return <Card>
    {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ?
      <NoRecords>{filters ? "No hay operaciones en esta búsqueda. Prueba con otro número o periodo." : undefined}</NoRecords> :
      <DataTable caption={caption} columns={["Operación", "Fecha", cashSession ? "Movimiento de efectivo" : "Importe", ...(cashSession ? ["Forma de pago"] : []), "Acción"]}
        rows={data.data.items.map((entry) => ({ id: entry.id, cells: [
          <div>{entry.number}<small className="record-secondary">{documentName(entry.kind)}
            {entry.linked && entry.kind === "expense" ? " · Anulado" : ""}
            {entry.linked && entry.kind === "quote" ? " · Convertida" : ""}</small></div>,
          dateLabel(entry.date), bob(cashSession ? entry.cashDeltaMinor : entry.totalMinor),
          ...(cashSession ? [methodLabel(entry.method)] : []),
          <Button variant="secondary" onClick={() => showDocument(entry.id)}>Ver detalle</Button>,
        ] }))} />}
    <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
  </Card>;
}

export function DocumentPage({ id, back, convert, openSerial, deliveries, openWork }: {
  id: string; back: () => void; convert: (quote: EntryDocument) => void; openSerial?: (serial: string) => void; deliveries?: boolean;
  openWork?: (id: string) => void;
}) {
  const data = useCommerceData<EntryDocument>("/documents/" + id);
  const document = data.data;
  const amount = document && documentAmount(document);
  const { showDocument } = useCommerce();
  const [error, setError] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [action, setAction] = useState<"return" | "void" | "exchange" | null>(null);
  async function savePdf() {
    if (!document) return;
    setError("");
    setLoadingPdf(true);
    try { await (await import("./pdf")).downloadDocument(document); }
    catch { setError("El comprobante sigue guardado. Intenta generar el PDF otra vez."); }
    finally { setLoadingPdf(false); }
  }
  return <div className="commerce-stack">
    <CommerceHeading title={document ? documentTitle(document.kind) : "Detalle de operación"}>
      <Button variant="secondary" icon="back" onClick={back}>Volver</Button>
    </CommerceHeading>
    {!document ? <LoadFeedback {...data} /> : <>
      <Card>
        <div className="page-heading">
          <div><h2>{document.number}</h2><p>{document.businessName} · {dateLabel(document.date)}</p></div>
          <Button icon="document" onClick={() => void savePdf()} disabled={loadingPdf}>{loadingPdf ? "Generando…" : "Guardar PDF"}</Button>
        </div>
        <p>Comprobante no fiscal</p>
        {document.practice && <Alert>PRÁCTICA — DATOS FICTICIOS</Alert>}
        {document.customerName && <p>{document.customerName}</p>}
        {document.method && <p>Forma de pago · {methodLabel(document.method)}</p>}
        {document.expiresOn && <p>Vigencia hasta {dateLabel(document.expiresOn)}</p>}
        {document.note && <p className="document-note">{document.note}</p>}
        {document.kind === "expense" && document.linked && <Alert>Gasto anulado</Alert>}
        {document.kind === "quote" && document.linked && <Alert>Cotización convertida en venta</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <dl className="business-summary document-summary">
          {!!document.discountMinor && <><dt>Descuento</dt><dd>{bob(document.discountMinor)}</dd></>}
          {amount && !isOperationalReceipt(document.kind) && <><dt>{amount.label}</dt><dd className="trade-total">{bob(amount.minor)}</dd></>}
          {!!document.cashDeltaMinor && <><dt>Movimiento de caja</dt><dd>{bob(document.cashDeltaMinor)}</dd></>}
          {!!document.debtDeltaMinor && <><dt>Movimiento del fiado</dt><dd>{bob(document.debtDeltaMinor)}</dd></>}
        </dl>
        {document.sourceId && <Button variant="plain" onClick={() => showDocument(document.sourceId!)}>Ver operación de origen</Button>}
        {document.work && openWork && <Button variant="plain" onClick={() => openWork(document.work!.id)}>
          Ver cita u orden · {document.work.title}</Button>}
      </Card>
      {document.lines.length > 0 && <Card><DataTable caption="Productos confirmados"
        columns={document.kind === "open-cement" ? ["Producto", "Cantidad", "Valor"] : ["Producto", "Cantidad", "Importe unitario", "Subtotal"]}
        rows={document.lines.map((line) => ({ id: line.lineId, cells: [
          <div>{line.name}<small className="record-secondary">{line.code}
            {line.returnedQuantity > 0 ? " · Devueltas " + line.returnedQuantity : ""}
            {line.restocked === false ? " · Sin reintegro" : ""}</small>
            {line.details && <small className="record-secondary">{describeLine(line)}</small>}
            {line.details?.serial && openSerial && <Button variant="plain" onClick={() => openSerial(line.details!.serial!)}>Historial de la serie</Button>}
            {line.timber && <small className="record-secondary">{documentTimber(document, line)}</small>}</div>,
          lineQuantity(line), ...(document.kind === "open-cement" ? [] : [<div>
            {bob(line.unitMinor) + documentUnit(document, line) + lineRate(line)}
            {line.details?.timberCatalogMinor != null && <small className="record-secondary">Catálogo · {bob(line.details.timberCatalogMinor)}/pie tablar</small>}
          </div>]),
          bob(line.subtotalMinor),
        ] }))} /></Card>}
      {document.containers.length > 0 && <Card><DataTable caption="Envases" columns={["Tipo", "Entrada", "Entregados", "Devueltos", "Saldo del cliente"]}
        rows={document.containers.map((row) => ({ id: row.name, cells: [row.name, row.added, row.delivered, row.returned, row.customerBalance ?? "—"] }))} /></Card>}
      {deliveries && document.kind === "sale" && <DeliveryPanel document={document} />}
      <div className="inline-actions">
        {document.kind === "quote" && !document.linked && <Button onClick={() => convert(document)}>Preparar venta desde la cotización</Button>}
        {["sale", "exchange"].includes(document.kind) && document.lines.some((line) => remainingQuantity(line) > 0) &&
          <Button variant="secondary" onClick={() => setAction("return")}>Registrar devolución</Button>}
        {["sale", "exchange"].includes(document.kind) && document.lines.some((line) => line.details?.apparel && remainingQuantity(line) > 0) &&
          <Button onClick={() => setAction("exchange")}>Iniciar cambio</Button>}
        {document.kind === "expense" && !document.linked &&
          <Button variant="secondary" onClick={() => setAction("void")}>Anular gasto</Button>}
      </div>
      {action === "return" && <ReturnEditor document={document} close={() => setAction(null)} />}
      {action === "exchange" && <ExchangeEditor document={document} close={() => setAction(null)} />}
      {action === "void" && <VoidEditor document={document} close={() => setAction(null)} />}
    </>}
  </div>;
}

function documentTitle(kind: string) {
  const name = documentName(kind);
  if (kind === "hold-lot" || kind === "release-lot" || isOperationalReceipt(kind)) return name;
  return name + (["exchange", "containers", "expense", "collect", "close-cash"].includes(kind) ? " confirmado" : " confirmada");
}

function ReturnEditor({ document, close }: { document: EntryDocument; close: () => void }) {
  const [chosen, setChosen] = useState<Record<string, { quantity: string; restock: boolean }>>({});
  const [note, setNote] = useState("");
  const [method, setMethod] = useState(document.method && document.method !== "credit" ? document.method : "cash");
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  return <OperationForm title="Devolución parcial o total" onClose={close} error={form.error} blocked={form.blocked}
    action="Confirmar devolución" onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => {
        const lines = document.lines.flatMap((line) => {
          const item = chosen[line.lineId];
          if (!item || Number(item.quantity.replace(",", ".")) <= 0 || !item.quantity) return [];
          const measured = line.details?.measure;
          return [{ productId: line.productId, originalLineId: line.lineId,
            quantity: measured ? 1 : Number(item.quantity), restock: item.restock,
            measure: measured ? { quantity: item.quantity.trim(), unit: returnUnit(measured) } : undefined }];
        });
        if (!lines.length) throw new Error("Indica al menos una pieza para devolver.");
        return { kind: "return", sourceId: document.id, note, method, lines };
      }, (result) => showDocument(result.entityId));
    }}>
    {document.lines.filter((line) => remainingQuantity(line) > 0).map((line) => {
      const withoutStock = line.details?.printing || line.details?.isService;
      const current = chosen[line.lineId] ?? { quantity: "0", restock: !withoutStock };
      const remaining = remainingQuantity(line);
      const measured = line.details?.measure;
      return <div className="return-line" key={line.lineId}>
        <TextField label={(line.details?.printing ? "Caras a devolver de " : line.details?.specialty?.countUnit === "pair" ? "Pares a devolver de " :
          measured ? "Cantidad a devolver (" + unitLabels[returnUnit(measured)] + ") de " :
          line.details?.isService ? "Cantidad a reembolsar de " : "Piezas a devolver de ") +
          line.name + (line.timber ? " · " + documentTimber(document, line) : line.details ? " · " + describeLine(line) : "")}
          hint={remaining + " disponibles de la venta original"}
          type="number" min={0} max={remaining} step={measured && returnUnit(measured) !== "piece" ? 0.001 : 1} value={current.quantity}
          onChange={(event) => setChosen({ ...chosen, [line.lineId]: { ...current, quantity: event.target.value } })} />
        {!withoutStock && <label className="trade-check"><input type="checkbox" checked={current.restock}
          onChange={(event) => setChosen({ ...chosen, [line.lineId]: { ...current, restock: event.target.checked } })} />
          {line.details?.serial ? "Enviar a inspección" : "Reintegrar a existencias"}</label>}
      </div>;
    })}
    {document.method === "credit" && <p>La devolución reduce primero el saldo fiado. Si corresponde, el excedente se reembolsa por el método elegido.</p>}
    <TextField label="Motivo de la devolución" maxLength={240} required value={note} onChange={(event) => setNote(event.target.value)} />
    <PaymentField value={method} onChange={setMethod} />
  </OperationForm>;
}

function VoidEditor({ document, close }: { document: EntryDocument; close: () => void }) {
  const [note, setNote] = useState("");
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  return <OperationForm title="Anular gasto" onClose={close} error={form.error} blocked={form.blocked} action="Confirmar anulación"
    onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "void-expense", sourceId: document.id, note }), (result) => showDocument(result.entityId));
    }}>
    <p>Se revertirá un gasto de <strong>{bob(document.totalMinor)}</strong> registrado con {methodLabel(document.method)}.</p>
    <TextField label="Motivo de anulación" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}
