import { useCallback, useState } from "react";
import { UNITS } from "../../../shared/workspace/catalog";
import { amount, div } from "../../../shared/workspace/exact";
import type {
  Item,
  Method,
  WorkspaceAction,
} from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import type { TradeDraftInput } from "./DraftRepository";
import DraftStatus from "./DraftStatus";
import { bob, cents, itemDetails, method, q, today } from "./format";
import { Icon } from "./Icon";
import IndustryHelp from "./IndustryHelp";
import { confirmDiscardChanges } from "./navigation";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { useTradeDraft } from "./useTradeDraft";

import type { CartLine } from "./Cart";
import { delivered, receiptInputs, saleInputs } from "./Cart";
import CartEditor from "./CartEditor";
import Quotes from "./QuoteHistory";
export default function Trade({
  purchase = false,
  initialQuote = false,
}: {
  purchase?: boolean;
  initialQuote?: boolean;
}) {
  const { business, repository, run, busy, prepare } = useWorkspace(),
    page = useRecords<Item>("items"),
    [lines, setLines] = useState<CartLine[]>([]),
    [barcode, setBarcode] = useState(""),
    [error, setError] = useState(""),
    [isQuote, setIsQuote] = useState(initialQuote),
    [quoteId, setQuoteId] = useState(""),
    [customerName, setCustomerName] = useState(""),
    [customerId, setCustomerId] = useState(""),
    [discount, setDiscount] = useState("0"),
    [validUntil, setValidUntil] = useState(() =>
      new Date(Date.parse(today() + "T12:00:00Z") + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  const [date, setDate] = useState(today),
    [payment, setPayment] = useState<Method | "credit">("cash"),
    [reference, setReference] = useState(""),
    [restoredNotice, setRestoredNotice] = useState("");
  const draftInput: TradeDraftInput = {
    lines: lines.map((line) => ({
      itemId: line.item.id,
      priceMinor: line.item.priceMinor,
      qty: line.qty,
      unit: line.unit,
      cost: line.cost,
      lot: line.lot,
      expiresOn: line.expiresOn,
      serials: purchase ? line.serials : [],
      fullBoxes: line.fullBoxes,
      wastePercent: line.wastePercent,
    })),
    isQuote,
    quoteId,
    customerId,
    customerName,
    discount,
    date,
    method: payment,
    reference,
    validUntil,
  };
  const resetConfirmed = useCallback(() => {
    setLines([]);
    setQuoteId("");
    setDiscount("0");
    setRestoredNotice("");
    if (initialQuote) setIsQuote(true);
  }, [initialQuote]);
  const draft = useTradeDraft(
    purchase ? "purchase" : initialQuote ? "quote" : "sale",
    draftInput,
    (restored) => {
      const saved = restored.draft.input;
      setLines(restored.lines);
      setIsQuote(restored.requiresNewQuote ? true : saved.isQuote);
      setQuoteId(restored.requiresNewQuote ? "" : saved.quoteId);
      setCustomerId(saved.customerId);
      setCustomerName(saved.customerName);
      setDiscount(saved.discount);
      setDate(saved.date);
      setPayment(saved.method);
      setReference(saved.reference);
      setValidUntil(saved.validUntil);
      setRestoredNotice(
        restored.requiresNewQuote
          ? "Los precios cambiaron. Se prepara una nueva cotización; revisa su vigencia."
          : restored.serialsCleared
            ? "Borrador restaurado. Selecciona otra vez las series de salida."
            : "Borrador restaurado con el catálogo actual.",
      );
    },
    resetConfirmed,
  );
  async function submitAction(action: WorkspaceAction) {
    const command = prepare(action);
    await draft.beforeSubmit(command, draftInput);
    try {
      const result = await run(action, command.operationId);
      if (result) await draft.confirmed(command);
      return result;
    } catch (cause) {
      await draft.failed(command, cause);
      throw cause;
    }
  }
  function addItem(item: Item) {
    if (lines.some((l) => l.item.id === item.id)) return;
    if (lines.length >= 20) {
      setError("Máximo 20 productos por operación. Divide la compra o venta.");
      return;
    }
    setLines((old) => [
      ...old,
      {
        item,
        qty: "1",
        unit: purchase
          ? item.kind === "appliance"
            ? "piece"
            : item.priceUnit
          : item.priceUnit,
        cost: "",
        lot: "",
        expiresOn: "",
        serials: [],
        fullBoxes: false,
        wastePercent: 0,
      },
    ]);
  }
  let total = 0;
  try {
    total =
      lines.reduce(
        (s, l) =>
          s +
          (purchase
            ? amount(cents(l.cost || "0"), q(l.qty))
            : amount(
                l.item.priceMinor,
                div(delivered(l), l.item.units[l.item.priceUnit]!),
              )),
        0,
      ) - (purchase ? 0 : cents(discount));
  } catch {
    /* Se muestran errores precisos al confirmar el formulario. */
  }
  return (
    <>
      <h2>
        {purchase
          ? "Compra de varios productos"
          : isQuote
            ? "Cotización sin reserva de stock"
            : "Nueva venta"}
      </h2>
      <p className="muted">
        {purchase
          ? "Selecciona los productos, declara su costo y revisa el pago."
          : isQuote
            ? "La cotización no reserva existencias. Su vigencia inicial es de siete días."
            : quoteId
              ? "Revisa la cotización original y confirma la venta con las existencias actuales."
              : "Selecciona productos y servicios. Revisa las cantidades y el total antes de confirmar."}
      </p>
      <IndustryHelp mode={purchase ? "purchase" : "sale"} />
      <DraftStatus draft={draft} />
      {restoredNotice && (
        <p role="status" className="notice notice-info">
          {restoredNotice}
        </p>
      )}
      <div className="trade-layout">
        <section className="trade-picker">
          <div className="card">
            <div className="section-heading">
              <h3>Seleccionar productos</h3>
              <Icon name="box" />
            </div>
            <ActionForm
              disabled={busy || !draft.editable}
              className="barcode-search"
              protectDraft={false}
              label="Buscar código"
              onSave={async () => {
                const result = await repository.list<Item>({
                  apiVersion: 2,
                  businessId: business.id,
                  resource: "items",
                  barcode: barcode.trim().toUpperCase(),
                });
                if (!result.items[0])
                  throw new Error("No se encontró ese código en este negocio.");
                addItem(result.items[0]);
                setBarcode("");
              }}
            >
              <label>
                Código de producto / lector como teclado
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </ActionForm>
            <Pager page={page} />
            <div className="product-picker">
              {page.items
                .filter((i) => i.active && (!purchase || i.kind !== "service"))
                .map((item) => (
                  <button
                    disabled={busy || !draft.editable}
                    key={item.id}
                    onClick={() => addItem(item)}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {itemDetails(item)} · {bob(item.priceMinor)}/
                      {UNITS[item.priceUnit]}
                    </small>
                  </button>
                ))}
            </div>
          </div>
        </section>
        <ActionForm
          className="trade-form"
          dirty={lines.length > 0}
          disabled={busy || !draft.editable || !lines.length}
          label={
            purchase
              ? "Confirmar compra y pago"
              : isQuote
                ? "Emitir cotización"
                : "Confirmar venta"
          }
          onSave={async (d) => {
            if (total <= 0)
              throw new Error("Revisa cantidades, precios y descuento.");
            if (d.get("review") !== "on")
              throw new Error("Confirma el importe antes de guardar.");
            let result;
            if (purchase)
              result = await submitAction({
                kind: "purchase",
                input: {
                  lines: receiptInputs(lines),
                  method: method(d),
                  date: String(d.get("date")),
                  reference: String(d.get("reference") ?? ""),
                },
              });
            else if (isQuote)
              result = await submitAction({
                kind: "quote",
                input: {
                  lines: saleInputs(lines),
                  customerId,
                  customerName,
                  discountMinor: cents(discount),
                  validUntil: String(d.get("validUntil")),
                },
              });
            else
              result = await submitAction({
                kind: "sale",
                input: {
                  lines: saleInputs(lines),
                  method: String(d.get("method")) as Method | "credit",
                  date: String(d.get("date")),
                  customerId,
                  customerName,
                  discountMinor: cents(discount),
                  quoteId,
                },
              });
            if (result) {
              resetConfirmed();
            }
          }}
        >
          <div className="section-heading">
            <h3>Detalle de la operación</h3>
            <span className="badge">{lines.length} líneas</span>
          </div>
          {error && (
            <p role="alert" className="notice notice-error">
              {error}
            </p>
          )}
          {!lines.length && (
            <div className="empty-state">
              <Icon name="sale" />
              <strong>Empieza seleccionando un producto</strong>
              <p>Las cantidades y el importe aparecerán aquí.</p>
            </div>
          )}
          {lines.map((line, index) => (
            <CartEditor
              key={line.item.id}
              line={line}
              purchase={purchase}
              quote={isQuote}
              update={(patch) =>
                setLines((old) =>
                  old.map((l, i) => (i === index ? { ...l, ...patch } : l)),
                )
              }
              remove={() =>
                setLines((old) => old.filter((_, i) => i !== index))
              }
            />
          ))}
          <div className="card cart-summary">
            <h3>Revisar importe: {bob(total)}</h3>
            {!purchase && (
              <>
                <CustomerSelector
                  value={customerId}
                  onChange={(id, name) => {
                    setCustomerId(id);
                    setCustomerName(name);
                  }}
                />
                <label>
                  Cliente (obligatorio para fiado)
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label>
                  Descuento total (BOB)
                  <input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </>
            )}
            {purchase && (
              <Field
                name="reference"
                label="Referencia de compra"
                value={reference}
                onValueChange={setReference}
                required={false}
                maxLength={100}
              />
            )}
            {isQuote ? (
              <Field
                name="validUntil"
                label="Válida hasta"
                type="date"
                value={validUntil}
                onValueChange={setValidUntil}
              />
            ) : (
              <>
                <Field
                  name="date"
                  label="Fecha"
                  type="date"
                  value={date}
                  onValueChange={setDate}
                />
                <MethodField
                  credit={!purchase}
                  value={payment}
                  onValueChange={setPayment}
                />
              </>
            )}
            <label>
              <input name="review" type="checkbox" required />
              He revisado cantidades e importe de {bob(total)}.
            </label>
          </div>
        </ActionForm>
      </div>
      {!purchase && initialQuote && (
        <Quotes
          onConvert={(quote) => {
            if (!confirmDiscardChanges()) return;
            setLines(
              quote.lines.map((l) => ({
                item: l.item,
                qty: l.qty,
                unit: l.unit,
                cost: "",
                lot: "",
                expiresOn: "",
                serials: [],
                fullBoxes: l.fullBoxes,
                wastePercent: l.wastePercent,
              })),
            );
            setCustomerName(quote.customerName);
            setCustomerId(quote.customerId);
            setDiscount((quote.discountMinor / 100).toFixed(2));
            setQuoteId(quote.priceChanged ? "" : quote.id);
            setIsQuote(quote.priceChanged);
            if (quote.priceChanged)
              setRestoredNotice(
                "Los precios cambiaron. Se prepara una nueva cotización, sin modificar la oferta original.",
              );
          }}
        />
      )}
    </>
  );
}
