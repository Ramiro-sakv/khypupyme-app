import { timberCategory } from "../../../shared/workspace/timber-species";
import TimberSpeciesPicker from "./TimberSpeciesPicker";
import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import { AppError } from "../../../shared/app-errors";
import { resolveTimber } from "./TimberWidthEntry";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import { useCallback, useId, useRef, useState } from "react";
import { UNITS } from "../../../shared/workspace/catalog";
import { div, add, ONE, showQuantity as showExact, ZERO } from "../../../shared/workspace/exact";
import type {
  Item,
  Method,
  WorkspaceAction,
} from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import type { TradeDraftInput } from "./DraftRepository";
import DraftStatus from "./DraftStatus";
import FashionPicker from "./FashionPicker";
import { bob, cents, itemDetails, measuredText, method, q, today } from "./format";
import { Icon } from "./Icon";
import IndustryHelp from "./IndustryHelp";
import { confirmDiscardChanges } from "./navigation";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { useTradeDraft } from "./useTradeDraft";

import type { CartLine } from "./Cart";
import { delivered, linePrice, receiptInputs, saleInputs } from "./Cart";
import CartEditor from "./CartEditor";
import TradeCheckout from "./TradeCheckout";
import Quotes from "./QuoteHistory";
export default function Trade({
  purchase = false,
  initialQuote = false,
  origin,
  initialClient,
}: {
  purchase?: boolean;
  initialQuote?: boolean;
  origin?: { kind: "appointment" | "work-order"; id: string; revision: number };
  initialClient?: { id: string; name: string };
}) {
  const { business, repository, run, busy, prepare } = useWorkspace(),
    [catalogSearch, setCatalogSearch] = useState(""),
    page = useRecords<Item>("items", {
      active: true,
      ...(catalogSearch.trim().length >= 2
        ? { search: catalogSearch.trim() }
        : {}),
    }),
    [source, setSource] = useState(origin ?? null),
    [lines, setLines] = useState<CartLine[]>([]),
    [barcode, setBarcode] = useState(""),
    [error, setError] = useState(""),
    [isQuote, setIsQuote] = useState(initialQuote),
    [quoteId, setQuoteId] = useState(""),
    [customerName, setCustomerName] = useState(initialClient?.name ?? ""),
    [customerId, setCustomerId] = useState(initialClient?.id ?? ""),
    [discount, setDiscount] = useState("0"),
    [validUntil, setValidUntil] = useState(() =>
      new Date(Date.parse(today() + "T12:00:00Z") + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  const [date, setDate] = useState(today),
    [payment, setPayment] = useState<Method | "credit">("cash"),
    [reference, setReference] = useState(""),
    [restoredNotice, setRestoredNotice] = useState(""),
    [checkoutExpanded, setCheckoutExpanded] = useState(false),
    [checkoutFeedback, setCheckoutFeedback] = useState<HTMLDivElement | null>(null);
  const checkoutId = useId();
  const checkoutTab = useRef<HTMLButtonElement>(null);
  const draftInput: TradeDraftInput = {
    ...(source ? { origin: source } : {}),
    lines: lines.map((line) => ({
      widthsEntry: line.widthsEntry,
      id: line.id,
      timber: line.timber,
      lengthInput: line.lengthInput,
      widthInput: line.widthInput,
      priceInput: line.priceInput,
      thicknessInput: line.thicknessInput,
      priceManual: line.priceManual,
      itemId: line.item.id,
      priceMinor: (() => { try { return line.item.timberSpecies && line.timber ? line.item.timberSpecies.prices[timberCategory(line.timber.lengthMm)] : line.item.priceMinor; } catch { return line.item.priceMinor; } })(),
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
    setCheckoutExpanded(false);
    setLines([]);
    setSource(null);
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
      setSource(saved.origin ?? null);
      setLines(restored.lines);
      setCheckoutExpanded(false);
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
          ? (restored.quoteIssue ??
              "Los precios cambiaron. Se prepara una nueva cotización; revisa su vigencia.")
          : restored.serialsCleared
            ? "Borrador restaurado. Selecciona otra vez las series de salida."
            : "Borrador restaurado con el catálogo actual.",
      );
    },
    resetConfirmed,
  );
  async function submitAction(action: WorkspaceAction) {
    const outgoing: WorkspaceAction =
      action.kind === "sale" && source
        ? {
            kind: "operational-sale",
            input: {
              sourceKind: source.kind,
              sourceId: source.id,
              expectedRevision: source.revision,
              sale: action.input,
            },
          }
        : action;
    const command = prepare(outgoing);
    await draft.beforeSubmit(command, draftInput);
    try {
      const result = await run(outgoing, command.operationId);
      if (result) await draft.confirmed(command);
      return result;
    } catch (cause) {
      await draft.failed(command, cause);
      throw cause;
    }
  }
  function addItem(item: Item) {
    if (!item.active || (purchase && item.kind === "service"))
      throw new Error("Selecciona un producto activo que admita esta operación.");
    const guidedSerials = business.industryId === "appliances" && item.kind === "appliance" && !isQuote;
    const current = item.kind === "timber-grouped" ? undefined : lines.find((line) => line.item.id === item.id);
    if (current) {
      if (guidedSerials) return;
      let qty: string;
      try { qty = showExact(add(q(current.qty || "0"), ONE)); }
      catch { setError("Corrige la cantidad del producto en el carrito antes de añadir otra unidad."); return; }
      setLines((old) =>
        old.map((l) =>
          l.item.id === item.id
            ? { ...l, qty }
            : l,
        ),
      );
      return;
    }
    if (lines.length >= 20) {
      setError("Máximo 20 productos por operación. Divide la compra o venta.");
      return;
    }
    setLines((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        ...(item.kind === "timber-grouped"
          ? {
              widthsEntry: {
                version: 2,
                system: business.timberSystem ?? "imperial",
                text: "",
                source: "text",
              },
              timber: { ...(item.timberSpecies ? { speciesId: item.timberSpecies.id, thicknessMm: item.fields.thicknessMm ?? "" } : {}), lengthMm: "", widths: [], priceMinor: item.priceMinor },
            }
          : {}),
        item,
        qty: item.kind === "timber-grouped" || guidedSerials ? "0" : "1",
        unit: ["timber-grouped", "timber-piece"].includes(item.kind)
          ? "piece"
          : purchase
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
  let timberPieces = 0,
    timberFeet = ZERO;
  for (const line of lines) {
    try {
      if (line.item.kind === "timber-grouped" && line.timber) {
        const t = timberTotals(
          line.item.fields.thicknessMm!,
          resolveTimber(line),
        );
        timberPieces += t.pieces;
        timberFeet = add(timberFeet, t.boardFeet);
      } else if (line.item.kind === "timber-volume") {
        timberFeet = add(
          timberFeet,
          div(delivered(line), line.item.units.boardFoot!),
        );
      } else if (line.item.kind === "timber-piece") {
        timberPieces += Number(delivered(line).n);
        timberFeet = add(
          timberFeet,
          div(delivered(line), line.item.units.boardFoot!),
        );
      }
    } catch {
      /* Medidas aún incompletas. */
    }
  }
  let total: number | null = lines.length ? 0 : null;
  let totalIssue = "";
  for (const line of lines) {
    const price = linePrice(line, purchase);
    if ("issue" in price) {
      total = null;
      totalIssue = line.item.name + ". " + price.issue;
      break;
    }
    total = (total ?? 0) + price.subtotal;
  }
  if (total !== null) {
    try {
      if (total > 1e12) throw new Error("El importe supera el límite de la operación.");
      total -= purchase ? 0 : cents(discount);
      if (total <= 0) throw new Error("El total debe ser mayor que cero. Revisa el importe y el descuento.");
    } catch (cause) {
      total = null;
      totalIssue = cause instanceof Error ? cause.message : "Revisa el importe.";
    }
  }
  const totalLabel = purchase ? "Total de compra" : isQuote ? "Total de cotización" : "Total de venta";
  const confirmLabel = purchase ? "Confirmar compra y pago" : isQuote ? "Emitir cotización" : "Confirmar venta";
  function openCheckout() {
    setCheckoutExpanded(true);
  }
  function minimizeCheckout() {
    setCheckoutExpanded(false);
    requestAnimationFrame(() => checkoutTab.current?.focus({ preventScroll: true }));
  }
  const totalText = total === null ? "Pendiente" : bob(total);
  const renderCheckout = (disabled: boolean) => lines.length > 0 && (
    <TradeCheckout id={checkoutId} open={checkoutExpanded} title={totalLabel + " · " + totalText} minimize={minimizeCheckout}>
      {totalIssue && <p role="status" className="muted">{totalIssue}</p>}
      {business.industryId === "timber" && (
        <p>{timberPieces} piezas · {showQuantity(timberFeet)} pies tablares</p>
      )}
      <fieldset className="trade-checkout-fields" disabled={!checkoutExpanded || disabled}>
        {!purchase && (
          <>
            <CustomerSelector
              value={customerId}
              selectedName={customerName}
              required={!isQuote && payment === "credit"}
              allowCreate
              compact
              onChange={(id, name) => {
                setCustomerId(id);
                setCustomerName(name);
              }}
            />
            <details>
              <summary>Nombre para el comprobante y descuento</summary>
              <label>
                Nombre para el comprobante (opcional)
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
            </details>
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
            <Field name="date" label="Fecha" type="date" value={date} onValueChange={setDate} />
            <MethodField credit={!purchase} value={payment} onValueChange={setPayment} />
          </>
        )}
        <label>
          <input key={JSON.stringify([draftInput.lines, discount])} name="review" type="checkbox" required />
          {total === null ? "Revisar importe cuando esté completo" : "He revisado cantidades e importe de " + bob(total) + "."}
        </label>
        <button type="submit" className="primary" data-tutorial="confirm-trade" disabled={total === null}>
          {busy ? "Procesando…" : confirmLabel}
        </button>
        <div ref={setCheckoutFeedback} />
      </fieldset>
    </TradeCheckout>
  );
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
      {source && (
        <p className="notice">
          Venta vinculada a una atención u orden. Conserva el cliente y confirma
          solo los productos y servicios realmente entregados.
        </p>
      )}
      <IndustryHelp mode={purchase ? "purchase" : "sale"} />
      <DraftStatus draft={draft} />
      {restoredNotice && (
        <p role="status" className="notice notice-info">
          {restoredNotice}
        </p>
      )}
      <div className="trade-operation" data-checkout={lines.length > 0 ? "visible" : undefined}>
        <div className="trade-scroll" role={lines.length ? "region" : undefined} aria-label={lines.length ? "Catálogo y artículos de la operación" : undefined} tabIndex={lines.length ? 0 : undefined}>
      <div className="trade-layout">
        <section className="trade-picker">
          <div className="card trade-catalog-card">
            <label className="trade-search-label">
              {business.industryId === "appliances" ? "Buscar por marca, modelo o código" : "Buscar en todo el catálogo (desde 2 caracteres)"}
              <input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                maxLength={40}
              />
            </label>
            <div className="section-heading">
              <h3>{business.industryId === "appliances" ? "Elegir modelo o accesorio" : "Seleccionar productos"}</h3>
              <Icon name="box" />
            </div>
            <ActionForm
              disabled={busy || !draft.editable}
              className="barcode-search"
              protectDraft={false}
              label="Añadir por código"
              onSave={async () => {
                const code = barcode.trim().toUpperCase();
                if (!code) throw new Error("Escribe o escanea el código del producto.");
                const result = await repository.list<Item>({
                  apiVersion: 2,
                  businessId: business.id,
                  resource: "items",
                  barcode: code,
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
                  maxLength={40}
                  required
                />
              </label>
            </ActionForm>
            {business.industryId === "timber" && <TimberSpeciesPicker search={catalogSearch} disabled={busy || !draft.editable} onPick={addItem} />}
            <Pager page={page} />
            {business.industryId === "clothing" && <FashionPicker items={page.items} pick={addItem} disabled={busy || !draft.editable} sell={!purchase && !isQuote} />}
            <div className="product-picker">
              {page.items
                .filter((i) => i.active && (!purchase || i.kind !== "service") && !(business.industryId === "clothing" && i.kind === "apparel"))
                .map((item) => (
                  <button
                    disabled={busy || !draft.editable}
                    data-tutorial="pick-item"
                    data-item-id={item.id}
                    key={item.id}
                    onClick={() => addItem(item)}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {itemDetails(item, business.timberSystem ?? "imperial")} ·{" "}
                      {bob(item.priceMinor)}/{UNITS[item.priceUnit]}
                    </small>
                    {business.industryId === "convenience" && item.kind !== "service" && (
                      <small>Existencia registrada · {measuredText(item, item.balance) ?? `${showQuantity(item.balance)} ${item.baseUnit}`}</small>
                    )}
                    {business.industryId === "appliances" && item.kind === "appliance" && <span className="badge">Equipo por serie</span>}
                  </button>
                ))}
            </div>
          </div>
        </section>
        <ActionForm
          dataTutorial="trade-form"
          className="trade-form"
          dirty={lines.length > 0}
          disabled={busy || !draft.editable || !lines.length}
          showSubmit={false}
          feedbackTarget={checkoutExpanded ? checkoutFeedback : null}
          outsideFieldset={renderCheckout}
          onSave={async (d) => {
            if (!checkoutExpanded) {
              openCheckout();
              return;
            }
            if (total === null) throw new AppError(totalIssue || "Completa la operación.", 400, "TRADE_TOTAL");
            if (d.get("review") !== "on") {
              setCheckoutExpanded(true);
              throw new AppError(
                "Confirma el importe antes de guardar.",
                400,
                "CHECKOUT_REVIEW",
                "review",
              );
            }
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
              key={line.id ?? line.item.id}
              line={line}
              purchase={purchase}
              quote={isQuote}
              fixedSerialQuantity={!!quoteId}
              duplicate={
                line.item.kind === "timber-grouped"
                  ? () => {
                      if (lines.length >= 20) {
                        setError(
                          "Máximo 20 grupos; divide la operación. [400]",
                        );
                        return;
                      }
                      setLines((old) => [
                        ...old,
                        {
                          ...line,
                          id: crypto.randomUUID(),
                          qty: "0",
                          widthInput: "",
                          widthsEntry: {
                            version: 2,
                            system:
                              line.widthsEntry?.system ??
                              business.timberSystem ??
                              "imperial",
                            text: "",
                            source: "text",
                          },
                          timber: { ...line.timber!, widths: [] },
                        },
                      ]);
                    }
                  : undefined
              }
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
        </ActionForm>
      </div>
        </div>
        {lines.length > 0 && (
          <div className="trade-bottom-tab" data-tutorial="review-trade">
            <div role="status">
              <strong>{totalLabel} · {totalText}</strong>
              {totalIssue && <small>{totalIssue}</small>}
            </div>
            <button type="button" className="primary" ref={checkoutTab} aria-haspopup="dialog"
              aria-controls={checkoutId} aria-expanded={checkoutExpanded} onClick={openCheckout}>
              Revisar
            </button>
          </div>
        )}
      </div>
      {!purchase && initialQuote && (
        <Quotes
          onConvert={(quote) => {
            if (!confirmDiscardChanges()) return;
            setLines(
              quote.lines.map((l) => ({
                id: crypto.randomUUID(),
                ...(l.timber ? { timber: l.timber, priceManual: !!l.item.timberSpecies && l.timber.priceMinor !== l.expectedPriceMinor } : {}),
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
