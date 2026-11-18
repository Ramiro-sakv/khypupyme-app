import { useState } from "react";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, PaymentField, useCommercialForm } from "./CommerceUi";
import { bob, dateLabel, documentName, methodLabel } from "./models";
import type { EntryDocument, EntryInfo, Page } from "./models";
import { documentTimber, documentUnit } from "../timber/measures";
import { describeLine, lineQuantity, lineRate, remainingQuantity, returnUnit, unitLabels } from "../retail/measures";
import { ExchangeEditor } from "../retail/ExchangeEditor";

const historyKinds = ["sale", "purchase", "quote", "return", "expense", "void-expense",
  "stock-loss", "open-cash", "close-cash", "collect", "exchange", "inspection",
  "containers", "container-stock", "hold-lot", "release-lot", "discard-lot"];

export function HistoryPage({ initialKind }: { initialKind: string }) {
  const [kind, setKind] = useState(initialKind);
  return <div className="commerce-stack">
    <CommerceHeading title="Historial" />
    <Card className="history-filter">
      <SelectField label="Tipo de operación" value={kind} onChange={(event) => setKind(event.target.value)}>
        <option value="">Todas</option>
        {historyKinds.map((value) => <option key={value} value={value}>{documentName(value)}</option>)}
      </SelectField>
    </Card>
    <EntryList key={kind} kind={kind} caption="Operaciones confirmadas" />
  </div>;
}

export function EntryList({ kind, cashSession, caption }: { kind?: string; cashSession?: string; caption: string }) {
  const [page, setPage] = useState(1);
  const { showDocument } = useCommerce();
  const query = new URLSearchParams({ page: String(page) });
  if (kind) query.set("kind", kind);
  if (cashSession) query.set("cashSession", cashSession);
  const data = useCommerceData<Page<EntryInfo>>("/history?" + query);
  return <Card>
    {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords /> :
      <DataTable caption={caption} columns={["Operación", "Fecha", cashSession ? "Movimiento de efectivo" : "Importe", "Acción"]}
        rows={data.data.items.map((entry) => ({ id: entry.id, cells: [
          <div>{entry.number}<small className="record-secondary">{documentName(entry.kind)}
            {entry.linked && entry.kind === "expense" ? " · Anulado" : ""}
            {entry.linked && entry.kind === "quote" ? " · Convertida" : ""}</small></div>,
          dateLabel(entry.date), bob(cashSession ? entry.cashDeltaMinor : entry.totalMinor),
          <Button variant="secondary" onClick={() => showDocument(entry.id)}>Ver detalle</Button>,
        ] }))} />}
    <Pages index={page} hasMore={data.data?.hasMore} onChange={setPage} />
  </Card>;
}

export function DocumentPage({ id, back, convert, openSerial }: {
  id: string; back: () => void; convert: (quote: EntryDocument) => void; openSerial?: (serial: string) => void;
}) {
  const data = useCommerceData<EntryDocument>("/documents/" + id);
  const document = data.data;
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
        {document.note && <p>{document.note}</p>}
        {document.kind === "expense" && document.linked && <Alert>Gasto anulado</Alert>}
        {document.kind === "quote" && document.linked && <Alert>Cotización convertida en venta</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <dl className="business-summary document-summary">
          {!!document.discountMinor && <><dt>Descuento</dt><dd>{bob(document.discountMinor)}</dd></>}
          <dt>{document.kind === "exchange" ? "Diferencia cobrada (+) o devuelta (−)" : "Total confirmado"}</dt><dd className="trade-total">{bob(document.totalMinor)}</dd>
          {!!document.cashDeltaMinor && <><dt>Movimiento de caja</dt><dd>{bob(document.cashDeltaMinor)}</dd></>}
          {!!document.debtDeltaMinor && <><dt>Movimiento del fiado</dt><dd>{bob(document.debtDeltaMinor)}</dd></>}
        </dl>
        {document.sourceId && <Button variant="plain" onClick={() => showDocument(document.sourceId!)}>Ver operación de origen</Button>}
      </Card>
      {document.lines.length > 0 && <Card><DataTable caption="Productos confirmados" columns={["Producto", "Cantidad", "Importe unitario", "Subtotal"]}
        rows={document.lines.map((line) => ({ id: line.lineId, cells: [
          <div>{line.name}<small className="record-secondary">{line.code}
            {line.returnedQuantity > 0 ? " · Devueltas " + line.returnedQuantity : ""}
            {line.restocked === false ? " · Sin reintegro" : ""}</small>
            {line.details && <small className="record-secondary">{describeLine(line)}</small>}
            {line.details?.serial && openSerial && <Button variant="plain" onClick={() => openSerial(line.details!.serial!)}>Historial de la serie</Button>}
            {line.timber && <small className="record-secondary">{documentTimber(document, line)}</small>}</div>,
          lineQuantity(line), bob(line.unitMinor) + documentUnit(document, line) + lineRate(line), bob(line.subtotalMinor),
        ] }))} /></Card>}
      {document.containers.length > 0 && <Card><DataTable caption="Envases" columns={["Tipo", "Entrada", "Entregados", "Devueltos", "Saldo del cliente"]}
        rows={document.containers.map((row) => ({ id: row.name, cells: [row.name, row.added, row.delivered, row.returned, row.customerBalance ?? "—"] }))} /></Card>}
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
  if (kind === "hold-lot" || kind === "release-lot") return name;
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
      const current = chosen[line.lineId] ?? { quantity: "0", restock: true };
      const remaining = remainingQuantity(line);
      const measured = line.details?.measure;
      return <div className="return-line" key={line.lineId}>
        <TextField label={(measured ? "Cantidad a devolver (" + unitLabels[returnUnit(measured)] + ") de " : "Piezas a devolver de ") +
          line.name + (line.timber ? " · " + documentTimber(document, line) : line.details ? " · " + describeLine(line) : "")}
          hint={remaining + " disponibles de la venta original"}
          type="number" min={0} max={remaining} step={measured && returnUnit(measured) !== "piece" ? 0.001 : 1} value={current.quantity}
          onChange={(event) => setChosen({ ...chosen, [line.lineId]: { ...current, quantity: event.target.value } })} />
        <label className="trade-check"><input type="checkbox" checked={current.restock}
          onChange={(event) => setChosen({ ...chosen, [line.lineId]: { ...current, restock: event.target.checked } })} />
          {line.details?.serial ? "Enviar a inspección" : "Reintegrar a existencias"}</label>
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
