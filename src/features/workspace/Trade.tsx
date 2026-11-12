import { timberCategory } from "../../../shared/workspace/timber-species";
import TimberSpeciesPicker from "./TimberSpeciesPicker";
import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import { AppError } from "../../../shared/app-errors";
import { resolveTimber } from "./TimberWidthEntry";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
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
import { bob, cents, method, q, today } from "./format";
import { Icon } from "./Icon";
import IndustryHelp from "./IndustryHelp";
import { confirmDiscardChanges } from "./navigation";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { useTradeDraft } from "./useTradeDraft";

import type { CartLine } from "./Cart";
import { delivered, linePrice, receiptInputs, saleInputs } from "./Cart";
import { useCartAvailability } from "./useCartAvailability";
import { hasSerialWorkflow, hasVariantMatrix } from "../../../shared/workspace/industry-capabilities";
import type { ContainerTransfer } from "../../../shared/workspace/operations";
import ContainerCheckout from "./ContainerCheckout";
import { VehicleFilter } from "./VehicleFilter";
import type { WorkspaceQuery } from "../../../shared/workspace/model";
import CartEditor from "./CartEditor";
import TradeCheckout from "./TradeCheckout";
import Quotes from "./QuoteHistory";
import { industryAppearance } from "./industryAppearance";
import { TradeProductPicker } from "./TradeProductPicker";
export default function Trade({
  purchase = false,
  initialQuote = false,
  origin,
  initialClient,
  initialItem,
}: {
  purchase?: boolean;
  initialQuote?: boolean;
  origin?: { kind: "appointment" | "work-order"; id: string; revision: number };
  initialClient?: { id: string; name: string };
  initialItem?: Item | undefined;
}) {
  const { business, repository, run, busy, prepare } = useWorkspace(),
    [catalogSearch, setCatalogSearch] = useState(""),
    [vehicle, setVehicle] = useState<WorkspaceQuery["vehicle"]>(),
    page = useRecords<Item>("items", {
      active: true,
      ...(vehicle ? { vehicle } : {}),
      ...(catalogSearch.trim().length >= 2
        ? { search: catalogSearch.trim() }
        : {}),
    }),
    [source, setSource] = useState(origin ?? null),
    [lines, setLines] = useState<CartLine[]>(() => initialItem ? [{ item: initialItem, qty: "1", unit: initialItem.priceUnit, cost: "", lot: "", expiresOn: "", serials: [], fullBoxes: false, wastePercent: 0 }] : []),
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
    [containers, setContainers] = useState<ContainerTransfer[]>([]),
    [restoredNotice, setRestoredNotice] = useState(""),
    [checkoutExpanded, setCheckoutExpanded] = useState(false),
    [checkoutFeedback, setCheckoutFeedback] = useState<HTMLDivElement | null>(null);
  const [params] = useSearchParams();
  const barcodeInput = useRef<HTMLInputElement>(null);
  const appearance = industryAppearance(business.industryId);
  const scanOnEntry = params.get("accion") === "escanear" && !purchase && !isQuote;
  const focusedScanner = useRef(false);
  const availability = useCartAvailability(lines, purchase, isQuote);
  const checkoutId = useId();
  const checkoutTab = useRef<HTMLButtonElement>(null);
  const draftInput: TradeDraftInput = {
    ...(source ? { origin: source } : {}),
    ...(containers.length ? { containers } : {}),
    lines: lines.map((line) => ({
      widthsEntry: line.widthsEntry,
      ...(line.packages ? { packages: line.packages } : {}),
      ...(line.print ? { print: line.print } : {}),
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
    setContainers([]);
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
      setContainers(saved.containers ?? []);
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
  useEffect(() => {
    if (!scanOnEntry) focusedScanner.current = false;
    if (!scanOnEntry || busy || !draft.editable || focusedScanner.current) return;
    barcodeInput.current?.focus();
    focusedScanner.current = true;
  }, [scanOnEntry, busy, draft.editable]);

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
    const guidedSerials = hasSerialWorkflow(business.industryId) && item.kind === "appliance" && !isQuote;
    const current = item.kind === "timber-grouped" ? undefined : lines.find((line) => line.item.id === item.id);
    if (current) {
      if (guidedSerials) return;
      let qty: string;
      try { qty = showExact(add(q(current.qty || "0"), ONE)); }
      catch { setError("Corrige la cantidad del producto en el carrito antes de añadir otra unidad."); return; }
      setLines((old) =>
        old.map((l) =>
          l.item.id === item.id
            ? { ...l, qty, ...(l.packages ? { packages: { ...l.packages, pieces: l.packages.pieces + 1 } } : {}),
                ...(l.print ? { print: { ...l.print, copies: l.print.copies + 1 }, qty: String((l.print.copies + 1) * l.print.faces) } : {}) }
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
        ...(!purchase && business.industryId === "beverages" && item.units.box && item.baseUnit === "piezas" ? { packages: { boxes: 0, pieces: 1 } } : {}),
        ...(!purchase && business.industryId === "stationery" && item.kind === "service" && item.details?.profile?.printSize && item.details.profile.printInk ? { print: { copies: 1, faces: 1, duplex: false } } : {}),
        unit: ["timber-grouped", "timber-piece"].includes(item.kind)
          ? "piece"
          : purchase
            ? item.kind === "appliance"
              ? "piece"
              : item.priceUnit
            : business.industryId === "beverages" && item.units.box && item.baseUnit === "piezas" ? "piece" : item.priceUnit,
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
      {availability.message && <div className="notice notice-warning" role="status">
        {availability.message} {availability.affected > 0 && !isQuote && "Minimiza la revisión para corregir el carrito."}
        {availability.error && <button type="button" onClick={availability.retry}>Reintentar</button>}
      </div>}
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
                if (id !== customerId) setContainers([]);
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
        {business.industryId === "beverages" && !purchase && !isQuote && <ContainerCheckout customerId={customerId} value={containers} change={setContainers} />}
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
          <input key={JSON.stringify([draftInput.lines, discount, containers])} name="review" type="checkbox" required />
          {total === null ? "Revisar importe cuando esté completo" : "He revisado cantidades e importe de " + bob(total) + "."}
        </label>
        <button type="submit" className="primary" data-tutorial="confirm-trade" disabled={total === null || !availability.ready}>
          {busy ? "Procesando…" : confirmLabel}
        </button>
        <div ref={setCheckoutFeedback} />
      </fieldset>
    </TradeCheckout>
  );
  return (
    <>
      <header className="operation-heading">
        <span className="business-symbol"><Icon name={purchase ? "purchase" : isQuote ? "document" : "sale"} /></span>
        <div>
          <h2>{purchase ? "Compra de varios productos" : isQuote ? "Nueva cotización" : "Nueva venta"}</h2>
          {isQuote && <p>Sin reserva de stock · vigencia inicial de siete días</p>}
          {!isQuote && quoteId && <p>Venta desde cotización · disponibilidad actual</p>}
        </div>
      </header>
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
      <div className="trade-operation" data-layout={appearance.layout} data-checkout={lines.length > 0 ? "visible" : undefined}>
        <div className="trade-scroll" role={lines.length ? "region" : undefined} aria-label={lines.length ? "Catálogo y artículos de la operación" : undefined} tabIndex={lines.length ? 0 : undefined}>
      <div className="trade-layout">
        <section className="trade-picker">
          <div className="card trade-catalog-card">
            <label className="trade-search-label">
              Buscar en todo el catálogo
              <input
                placeholder={appearance.search}
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                maxLength={40}
              />
            </label>
            {business.industryId === "spareParts" && <VehicleFilter value={vehicle} onChange={setVehicle} />}
            <div className="section-heading">
              <h3>{appearance.inventory}</h3>
              <Icon name={appearance.icon} />
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
                  ref={barcodeInput}
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
            {hasVariantMatrix(business.industryId) && <FashionPicker items={page.items} pick={addItem} disabled={busy || !draft.editable} sell={!purchase && !isQuote} />}
            <TradeProductPicker items={page.items} industry={business.industryId}
              timberSystem={business.timberSystem ?? "imperial"} disabled={busy || !draft.editable}
              purchase={purchase} onPick={addItem} />
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
            if (!availability.ready) throw new AppError(availability.message || "Comprueba las cantidades del carrito.", 400, "CHECKOUT_STOCK");
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
                  ...(containers.length ? { containers } : {}),
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
              stock={availability.rows.get(index)}
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
          <div className="trade-bottom-tab" data-tutorial="review-trade" data-stock-warning={availability.affected > 0 || !!availability.error}>
            <div role="status">
              <strong>{totalLabel} · {totalText}</strong>
              {totalIssue && <small>{totalIssue}</small>}
              {availability.message && <small>{availability.message}</small>}
            </div>
            <button type="button" className="primary" ref={checkoutTab} aria-haspopup="dialog"
              aria-controls={checkoutId} aria-expanded={checkoutExpanded} onClick={openCheckout}>
              Revisar <Icon name="arrow" />
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
                ...(l.packages ? { packages: l.packages } : {}),
                ...(l.print ? { print: l.print } : {}),
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
            setContainers([]);
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
