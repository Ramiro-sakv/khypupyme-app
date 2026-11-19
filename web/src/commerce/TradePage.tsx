import { useEffect, useRef, useState } from "react";
import { get } from "../api/client";
import { Alert, Button, Card, DataTable, EmptyState, TextField } from "../ui/Primitives";
import { Icon } from "../ui/Icon";
import { TradeHelp } from "../businesses/BusinessHelp";
import { ReviewDock } from "../ui/ReviewDock";
import { CustomerEditor } from "./CatalogPage";
import { OperationHeading } from "./OperationHeading";
import { HistoryPage } from "./Documents";
import type { OperatingPolicy } from "../businesses/models";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, Pages, PaymentField, SearchForm, useCommercialForm } from "./CommerceUi";
import { bob, editableMoney, moneyLimit, parseMoney } from "./models";
import type { CommandLine, Customer, EntryDocument, Page, Product } from "./models";
import { useDraft } from "./useDraft";
import { TimberFields } from "../timber/TimberFields";
import { displayMeasure, timberRate, unitsOf } from "../timber/measures";
import type { Capture, Rates, TimberUnits } from "../timber/measures";
import { prepareTimber, stockKey } from "../timber/trade";
import { StockFeedback, useStockCheck } from "./stock";
import type { StockLine } from "./stock";
import { BarcodeField, MeasuredFields, SerialPicker, VariantMatrix, equivalence } from "../retail/TradeFields";
import { measurePreview, productAvailability, seriesFromText, unitLabels } from "../retail/measures";
import type { Measure } from "../retail/measures";
import { ContainerFields, prepareContainerMoves, useContainerBalances } from "../retail/Containers";
import type { ContainerDraft } from "../retail/Containers";
import { PetLotField } from "../retail/PetLots";
import { CompatibilityFilter, emptyVehicle, searchLabel, SpecialtySummary, vehicleQuery } from "../retail/SpecialtyFields";
import { PrintingFields, previewPrinting } from "../retail/PrintingFields";
import type { PrintDraft } from "../retail/PrintingFields";
import { TileFields, tilePreview } from "../retail/MaterialFields";
import type { TileRequest } from "../retail/MaterialFields";
import type { Work } from "../services/work";

export type TradeKind = "sale" | "purchase" | "quote" | "stock-in";
type Line = { id: string; key?: string; name: string; quantity: string; priceMinor: number; cost: string; timberCostUnit?: "board-foot"; timber?: Capture; rates?: Rates; manualPrice?: string;
  measure?: Omit<Measure, "quantity">; series?: string; printing?: PrintDraft; tile?: TileRequest };
type TradeDraft = {
  lines: Line[]; customer?: { id: string; name: string }; discount: string; note: string; method: string; quote?: string;
  containers?: ContainerDraft;
};
function blankDraft(method = "cash"): TradeDraft { return { lines: [], discount: "0", method, note: "" }; }
const emptyTile: TileRequest = { area: null, waste: null, tone: null, caliber: null };
const titles: Record<TradeKind, string> = { sale: "Venta nueva", purchase: "Compra nueva", quote: "Cotización nueva", "stock-in": "Entrada manual de inventario" };
const label: Record<TradeKind, string> = { sale: "venta", purchase: "compra", quote: "cotización", "stock-in": "entrada" };

export function TradePage({ kind, proposal, dismissProposal, onHistory, units = "imperial", industry, work, workService, onWorkBack, scan, onStockBack, onOpenCatalog, showHistory = false, setShowHistory, policy }: {
  kind: TradeKind; proposal?: EntryDocument; dismissProposal: () => void; onHistory: () => void; units?: TimberUnits; industry?: string;
  work?: Work; workService?: Product; onWorkBack?: () => void; scan?: boolean;
  onStockBack?: () => void;
  onOpenCatalog?: () => void;
  showHistory?: boolean;
  policy?: OperatingPolicy;
  setShowHistory?: (visible: boolean) => void;
}) {
  const workspace = useCommerce();
  const initialDraft = blankDraft(policy?.defaultPayment);
  const draftKey = workspace.scope + ":" + kind + (work ? ":work:" + work.id : "");
  const { value, update: saveDraft, ready, error, flush, reload } = useDraft(draftKey, work ? { ...initialDraft, note: work.title,
    lines: workService ? [{ id: workService.id, name: workService.name, quantity: "1", priceMinor: workService.priceMinor, cost: "" }] : [] } : initialDraft);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [vehicle, setVehicle] = useState(emptyVehicle);
  const [acknowledged, setAcknowledged] = useState("");
  const [stockVersion, setStockVersion] = useState(0);
  function update(produce: (draft: TradeDraft) => TradeDraft) {
    setAcknowledged("");
    saveDraft((draft) => {
      const next = produce(draft);
      if (next.lines !== draft.lines) setStockVersion((version) => version + 1);
      return next;
    });
  }
  const cart = useRef<HTMLHeadingElement>(null);
  const stockIn = kind === "stock-in";
  const isPurchase = kind === "purchase" || stockIn;
  const products = useCommerceData<Page<Product>>("/products?" + new URLSearchParams({ active: "true", search, page: String(page),
    ...(isPurchase ? { service: "false" } : {}),
    ...(industry === "spareParts" ? vehicleQuery(vehicle) : {}) }));
  const current = useCurrentProducts([...new Set(value.lines.map((line) => line.id))].join(","));
  const form = useCommercialForm();
  const confirmation = workspace.confirmation;
  const frozen = form.processing || workspace.pending?.draft?.key === draftKey;
  const quote = kind === "quote";
  const mixed = industry === "beverages";
  const withContainers = mixed && kind === "sale";
  const petSale = industry === "pets" && kind === "sale";
  const containerBalances = useContainerBalances(withContainers, value.customer?.id);
  const containers = prepareContainerMoves(value.containers ?? {}, containerBalances.data, value.customer?.id);

  useEffect(() => {
    if (confirmation?.draft?.key === draftKey) void reload();
  }, [confirmation, draftKey, reload]);

  const discount = isPurchase ? 0 : parseMoney(value.discount);
  const timberLines = value.lines.flatMap((line) => line.timber ? [{ ...line, timber: line.timber }] : []);
  const timber = prepareTimber(timberLines, current.data, isPurchase);
  const lines = value.lines.filter((line) => !line.timber).map((line) => {
    const product = current.data?.[line.id];
    const serials = line.series === undefined ? undefined : seriesFromText(line.series);
    const printing = previewPrinting(line.printing);
    const quantity = printing?.faces ?? serials?.length ?? Number(line.quantity);
    const tile = product?.specialty?.material?.tile;
    const tileRequest = !isPurchase && tile ? line.tile ?? emptyTile : undefined;
    const estimate = tile && tileRequest && line.measure && product?.retail ?
      tilePreview(tile, tileRequest, line.measure.unit, product.retail.boxSize) : null;
    const tileIncomplete = !!tileRequest && ((!estimate && !!(tileRequest.area?.trim() || tileRequest.waste?.trim())) ||
      (tile?.tone ?? "") !== (tileRequest.tone ?? "") || (tile?.caliber ?? "") !== (tileRequest.caliber ?? ""));
    const measure = line.measure && { ...line.measure, quantity: estimate ? String(estimate.quantity) : line.quantity.trim(),
      lot: line.measure.lot?.trim() || undefined };
    const validQuantity = (serials ? quantity <= 100 && new Set(serials.map((serial) => serial.toUpperCase())).size === quantity &&
      serials.every((serial) => serial.length <= 80) && (!value.quote || quantity === Number(line.quantity)) : /^\d+$/.test(line.quantity)) &&
      quantity >= 1 && quantity <= 1_000_000;
    const unitMinor = isPurchase ? parseMoney(line.cost) : line.priceMinor;
    const measured = measure && product?.retail ?
      measurePreview(measure.quantity, measure.unit, product.retail, isPurchase, unitMinor, measure.loose, mixed, !!tile) : undefined;
    const subtotal = line.printing ? !isPurchase && printing && unitMinor !== null && printing.faces * unitMinor <= moneyLimit ? printing.faces * unitMinor : null :
      measure ? tileIncomplete || (isPurchase && product?.retail?.trackLots && !measure.lot) ? null : measured?.subtotal ?? null :
      validQuantity && unitMinor !== null && quantity * unitMinor <= moneyLimit ? quantity * unitMinor : null;
    const requested = line.printing || product?.isService ? undefined : measure ? measured?.base : validQuantity ? quantity : undefined;
    return {
      line, product, quantity, unitMinor, subtotal, measure, serials, requested, printing, tile, tileRequest, tileIncomplete,
      changed: !isPurchase && product !== undefined && product.priceMinor !== line.priceMinor,
    };
  });
  const stockLines: StockLine[] = [
    ...(!isPurchase ? timber.commands.map(({ productId, quantity, timber }) => ({ productId, quantity, timber })) : []),
    ...lines.flatMap(({ line, product, serials, measure, quantity, requested, tileRequest, tileIncomplete }): StockLine[] =>
      product?.active && (isPurchase ? !!serials?.length : requested !== undefined && !tileIncomplete) &&
        (!serials || serials.every((serial) => serial.length <= 80))
        ? [{ productId: line.id, quantity: measure ? 1 : quantity, measure, serials, tile: tileRequest }] : []),
  ];
  const stockCheck = useStockCheck(stockLines, isPurchase, quote, stockVersion);
  const failedChecks = stockCheck.checks?.filter((row) => row.requested > row.available || !!row.reason) ?? [];
  const stockBlocked = (stockLines.length > 0 && !stockCheck.checks) || failedChecks.length > 0;
  const stockByMeasure = new Map(stockCheck.checks?.flatMap((row) => row.timber
    ? [[stockKey(row.productId, row.timber), row.available] as const] : []));
  const stockByProduct = new Map(stockCheck.checks?.flatMap((row) => !row.timber && !row.serial
    ? [[row.productId + (row.lot ? ":" + row.lot : ""), row] as const] : []));
  const scopedSeries = lines.flatMap((row) => row.serials?.map((serial) => serial.toUpperCase()) ?? []);
  const invalidSeries = scopedSeries.length > 100 || new Set(scopedSeries).size !== scopedSeries.length;
  const lotKeys = lines.flatMap((row) => row.measure?.lot ? [row.line.id + ":" + row.measure.lot.toUpperCase()] : []);
  const duplicateLots = isPurchase && new Set(lotKeys).size !== lotKeys.length;
  const gross = lines.reduce((sum, item) => sum + (item.subtotal ?? 0), timber.gross);
  const distinctGroups = new Set(timber.commands.map((row) => [row.productId, row.timber.lengthMicros, row.timber.thicknessMicros].join(":")));
  const commercialGroups = new Set(lines.map((row) => row.line.id)).size + distinctGroups.size;
  const limitReached = commercialGroups > 20 || timber.commands.length + lines.length > 100;
  const total = value.lines.length > 0 && lines.every((item) => item.subtotal !== null) && timber.groups.every((group) => group.total !== null) &&
    !limitReached && !timber.problem && !invalidSeries && !duplicateLots &&
    gross <= moneyLimit && discount !== null && discount <= gross ? gross - discount : null;
  const unavailable = !current.data || lines.some(({ product, changed }) => !product?.active || changed) ||
    timberLines.some((line) => !current.data?.[line.id]?.active || !current.data[line.id].timber) ||
    ((kind === "sale" || isPurchase) && stockBlocked);
  const customerId = work?.customerId ?? value.customer?.id;
  const payingOnCredit = kind === "sale" && value.method === "credit";
  const creditAllowed = policy?.allowNewCredit ?? true;
  const requiresCustomer = payingOnCredit && creditAllowed && (!customerId || total === 0);
  const creditBlocked = payingOnCredit && !creditAllowed;
  const maxDiscount = policy?.maxDiscountPercent ?? 100;
  const discountBlocked = !value.quote && discount !== null && discount * 100 > gross * maxDiscount;
  const missingService = !!work?.serviceId && !value.lines.some((line) => line.id === work.serviceId && line.quantity === "1");
  const reviewKey = JSON.stringify([value.lines, value.discount, value.method, customerId, value.quote, total, timber.commands, value.containers, work?.revision]);
  const canSend = total !== null && !unavailable && !requiresCustomer && !creditBlocked && !discountBlocked && !missingService && !error && !containers.error &&
    (!stockIn || !!value.note.trim()) && acknowledged === reviewKey;
  const totalText = total === null ? "Pendiente" : bob(total);

  function add(product: Product, newLot = false) {
    if (isPurchase && (product.isService || product.specialty?.material?.cement?.isBulk)) return;
    update((currentDraft) => {
      if (product.timber) {
        if (currentDraft.lines.length >= 100) return currentDraft;
        return { ...currentDraft, lines: [...currentDraft.lines, { id: product.id, key: crypto.randomUUID(),
          name: product.name, quantity: "", priceMinor: product.priceMinor, cost: "", rates: product.timber, timberCostUnit: isPurchase ? "board-foot" : undefined,
          timber: { units, length: "", thickness: "", widths: "" } }] };
      }
      const existing = currentDraft.lines.find((line) => line.id === product.id);
      if (existing && !newLot) {
        if (product.id === work?.serviceId || product.equipment && !quote || product.specialty?.printing) return currentDraft;
        const quantity = Number(existing.quantity.replace(",", "."));
        return { ...currentDraft, lines: currentDraft.lines.map((line) => line === existing
          ? { ...line, quantity: String(Math.min(1_000_000, Math.round(((quantity || 0) + 1) * 1000) / 1000)) } : line) };
      }
      if (currentDraft.lines.length >= 100 ||
        !existing && new Set(currentDraft.lines.filter((line) => !line.timber).map((line) => line.id)).size >= 20) return currentDraft;
      return { ...currentDraft, lines: [...currentDraft.lines, { id: product.id, name: product.name,
        key: newLot ? crypto.randomUUID() : undefined,
        quantity: "1", priceMinor: product.priceMinor, cost: "",
        measure: product.retail ? { unit: product.specialty?.material?.tile || (isPurchase && product.retail.unit === "piece" && product.retail.boxSize > 1) ? "box" :
          isPurchase && product.retail.unit === "m" ? "roll" : product.retail.unit } : undefined,
        printing: product.specialty?.printing ? { copies: "1", facesPerCopy: "1", duplex: false } : undefined,
        series: product.equipment && !quote ? "" : undefined }] };
    });
  }

  function edit(id: string, fields: Partial<Line>) {
    update((draft) => ({ ...draft, lines: draft.lines.map((line) => (line.key ?? line.id) === id ? { ...line, ...fields } : line) }));
  }
  function remove(id: string) {
    update((draft) => ({ ...draft, lines: draft.lines.filter((line) => (line.key ?? line.id) !== id) }));
  }

  const area = !work && (kind === "sale" || kind === "purchase") ? kind : undefined;
  const historyTitle = kind === "purchase" ? "Historial de compras" : "Historial de ventas";
  const modeTitle = area === "purchase" ? "Registrar compra" : "Registrar venta";
  if (!ready) return <><CommerceHeading title={titles[kind]} /><LoadFeedback error={error || undefined} reload={() => void reload()} /></>;

  const editor = <div className="trade-pane commerce-stack" hidden={showHistory}>
    {stockIn ? <Alert>Indica las cantidades, el costo de las existencias y el motivo de la entrada. Este movimiento no registra un pago.</Alert> : null}
    {value.lines.length > 0 && <p className="trade-draft-note"><Icon name="document" /> Borrador local · Se registra al confirmar</p>}
    {work && <Alert>{work.title} · {work.customerName}{work.budgetMinor == null ? "" : " · Presupuesto " + bob(work.budgetMinor)}</Alert>}
    {workService && !workService.active && <Alert tone="error">El servicio del trabajo está archivado. Actívalo en Catálogo para cobrar.</Alert>}
    {missingService && workService && <Card><Alert>Falta el servicio del trabajo. Añade una unidad para continuar.</Alert>
      <Button disabled={frozen} variant="secondary" onClick={() => value.lines.some((line) => line.id === workService.id)
        ? edit(workService.id, { quantity: "1" }) : add(workService)}>Usar una unidad de {workService.name}</Button></Card>}
    {quote && <Alert>La cotización tiene siete días de vigencia. Al convertirla, la venta verifica precio y existencias.</Alert>}
    {error && <Alert tone="error">{error}<br /><Button variant="secondary" onClick={() => void reload()}>Cargar borrador guardado</Button></Alert>}
    {proposal && !frozen && <Card>
      <h2>Cotización {proposal.number}</h2>
      <p>{value.lines.length ? "Cargar esta cotización reemplazará los artículos del borrador de venta." : "Carga los artículos para revisar y cobrar la venta."}</p>
      <div className="inline-actions commerce-top">
        <Button variant="secondary" onClick={dismissProposal}>Omitir</Button>
        <Button onClick={() => {
          update(() => ({ ...initialDraft, quote: proposal.id, note: proposal.note, discount: editableMoney(proposal.discountMinor),
            customer: proposal.customerId && proposal.customerName ? { id: proposal.customerId, name: proposal.customerName } : undefined,
            lines: proposal.lines.map((line) => ({ id: line.productId, name: line.name, quantity: line.details?.measure?.quantity ?? String(line.quantity),
              priceMinor: line.unitMinor, cost: "", key: line.timber ? line.lineId : undefined,
              measure: line.details?.measure ? { unit: line.details.measure.unit, loose: line.details.measure.loose } : undefined,
              tile: line.details?.tile?.request,
              printing: line.details?.printing ? { copies: String(line.details.printing.job.copies),
                facesPerCopy: String(line.details.printing.job.facesPerCopy), duplex: line.details.printing.job.duplex } : undefined,
              series: line.details?.direction === "choose-series" ? "" : undefined,
              rates: line.timber ? { species: line.species ?? "", superShortMinor: line.unitMinor, shortMinor: line.unitMinor, longMinor: line.unitMinor } : undefined,
              manualPrice: line.timber && line.details?.timberCatalogMinor != null ? editableMoney(line.unitMinor) : undefined,
              timber: line.timber ? { units: unitsOf(proposal.timberUnits), length: "", thickness: "", widths: "",
                selection: { timber: line.timber, quantity: String(line.quantity) } } : undefined })) }));
          dismissProposal();
        }}>Cargar cotización</Button>
      </div>
    </Card>}
    <div className="trade-split">
      <Card className="trade-catalog">
        <div className="page-heading">
          <h2 className="trade-catalog-heading">{industry === "timber" ? "Madera y medidas" : "Productos"}</h2>
          {value.lines.length > 0 && <Button variant="plain" icon="cart" onClick={() => cart.current?.focus()}>
            Ir al carrito
          </Button>}
        </div>
        <SearchForm instant label={searchLabel(industry)}
          onSearch={(query) => { setSearch(query); setPage(1); setSelectedModel(""); }} />
        <BarcodeField add={add} disabled={frozen} focus={scan}
          accepts={(product) => !isPurchase || (!product.isService && !product.specialty?.printing && !product.specialty?.material?.cement?.isBulk)} />
        {industry === "spareParts" && <CompatibilityFilter onChange={(filter) => { setVehicle(filter); setPage(1); }} />}
        {!stockIn && <TradeHelp industry={industry} />}
        {!products.data ? <LoadFeedback {...products} /> : products.data.items.length === 0 ? <>
          <NoRecords>{search ? "Prueba otro nombre, especie o código." : "Crea un producto en Inventario para añadirlo aquí."}</NoRecords>
          {!search && onOpenCatalog && <Button variant="secondary" icon="grid" onClick={onOpenCatalog}>Ir a inventario</Button>}
        </> :
          <ul className="trade-products trade-product-grid">
            {products.data.items.filter((product, index, all) => (!isPurchase || (!product.specialty?.printing && !product.specialty?.material?.cement?.isBulk)) && (!product.apparel ||
              all.findIndex((item) => item.apparel?.model.toUpperCase() === product.apparel?.model.toUpperCase()) === index))
              .map((product) => <li key={product.id}>
              <button type="button" className="trade-product" disabled={frozen || (product.timber ? value.lines.length >= 100 :
                !product.apparel && commercialGroups >= 20 && !lines.some((item) => item.line.id === product.id))}
                onClick={() => product.apparel ? setSelectedModel(product.apparel.model) : add(product)}>
                <div className="trade-product-name"><strong>{product.apparel?.model ?? product.name}</strong><Icon name="plus" /></div>
                {product.apparel ? <span>Elegir talla y color</span> : <>
                  <span>{product.timber?.species && product.timber.species + " · "}{product.code}</span>
                  <span className="trade-stock">{!product.isService && (product.retail ? !product.sellableStock : !product.stock) ? "Sin stock" : productAvailability(product) + (product.specialty?.printing || product.isService ? "" : " disponibles")}{product.timber ? " por medidas" : ""}</span>
                  {(product.timber
                    ? <span className="trade-price timber-rates">
                      <span>1–2 pies · {bob(product.timber.superShortMinor)}</span>
                      <span>3–6 pies · {bob(product.timber.shortMinor)}</span>
                      <span>7–20 pies · {bob(product.timber.longMinor)}</span>
                      <small>Por pie tablar</small>
                    </span>
                    : !isPurchase && <span className="trade-price">{bob(product.priceMinor)}</span>)}
                </>}
              </button>
            </li>)}
          </ul>}
        <Pages index={page} hasMore={products.data?.hasMore} onChange={setPage} />
        {isPurchase && products.data?.items.some((product) => product.specialty?.printing) && <p>Los servicios de impresión se cobran desde Ventas.</p>}
        {selectedModel && <VariantMatrix model={selectedModel} choose={add} disabled={frozen} />}
      </Card>
      <Card className="trade-cart">
        <div className="page-heading">
          <h2 ref={cart} tabIndex={-1}>Carrito</h2>
          <strong className="trade-total" aria-live="polite">Total de {label[kind]} · {totalText}</strong>
        </div>
        {value.quote && <div className="inline-actions">
          <p>Venta vinculada a cotización</p>
          <Button variant="plain" disabled={frozen} onClick={() => update((draft) => ({ ...draft, quote: undefined }))}>Quitar vínculo</Button>
        </div>}
        {value.lines.length === 0 && <EmptyState title="Empieza seleccionando un producto" icon="cart">
          Las cantidades y el importe aparecerán aquí.
        </EmptyState>}
        {lines.some((row) => !row.line.measure && !row.line.printing && row.line.series === undefined && !row.product?.equipment) &&
          <DataTable caption="Líneas del borrador" columns={["Producto", industry === "footwear" ? "Pares" : "Cantidad", isPurchase ? "Costo unitario" : "Precio unitario", "Subtotal", "Acción"]}
            rows={lines.filter((row) => !row.line.measure && !row.line.printing && row.line.series === undefined && !row.product?.equipment).map(({ line, product, changed, unitMinor, subtotal }) => ({ id: line.id, cells: [
              <div>{product?.name ?? line.name}
                {product && <SpecialtySummary product={product} />}
                {industry === "spareParts" && !product?.specialty?.parts && <small>Compatibilidad por confirmar</small>}
                {product?.apparel && <small className="record-secondary">Talla {product.apparel.size} · {product.apparel.color}</small>}
                {product?.isService && <small className="record-secondary">Servicio</small>}
                {product && !product.isService && !isPurchase && <small className="record-secondary">
                  <StockFeedback row={stockByProduct.get(line.id)} countUnit={product.specialty?.countUnit === "pair" ? "pares" : undefined} />
                </small>}
                {product && !product.active && <small className="trade-issue">Producto archivado</small>}
              </div>,
              <TextField label={(product?.isService ? "Cantidad de " : product?.specialty?.countUnit === "pair" ? "Pares de " : "Piezas de ") + line.name}
                type="number" min={1} max={1_000_000} step={1} value={line.quantity}
                disabled={frozen || line.id === work?.serviceId} onChange={(event) => edit(line.id, { quantity: event.target.value })} />,
              isPurchase ? <TextField label={"Costo de " + line.name} inputMode="decimal" value={line.cost} disabled={frozen}
                onChange={(event) => edit(line.id, { cost: event.target.value })} /> :
                <div>{unitMinor !== null && bob(unitMinor)}
                  {changed && product && <Button variant="plain" disabled={frozen}
                    onClick={() => edit(line.id, { priceMinor: product.priceMinor })}>Usar precio actualizado</Button>}</div>,
              subtotal === null ? "Pendiente" : bob(subtotal),
              line.id !== work?.serviceId && <Button variant="plain" aria-label={"Quitar " + line.name} disabled={frozen}
                onClick={() => remove(line.id)}>Quitar</Button>,
            ] }))} />}
        {lines.filter((row) => row.line.measure || row.line.printing || row.line.series !== undefined || row.product?.equipment).map(({ line, product, changed,
          requested, subtotal, measure, serials, tile, tileRequest }) => {
          const key = line.key ?? line.id;
          const unit = product?.retail?.unit;
          const bag = !!product?.specialty?.material?.cement && !product.specialty.material.cement.isBulk;
          return <Card className="store-line" key={key}>
            <div className="page-heading"><h3>{line.name}</h3>
              <Button variant="plain" onClick={() => remove(key)} disabled={frozen}>Quitar</Button></div>
            {product && <SpecialtySummary product={product} />}
            {line.printing && <PrintingFields value={line.printing} disabled={frozen}
              update={(printing) => edit(key, { printing })} />}
            {measure && product?.retail && <MeasuredFields profile={product.retail} quantity={measure.quantity} measure={measure}
              buying={isPurchase} mixed={mixed} boxSale={!!tile && !isPurchase} bag={bag} lockedQuantity={!!tileRequest?.area?.trim()}
              disabled={frozen} onQuantity={(quantity) => edit(key, { quantity })}
              onMeasure={(entry) => edit(key, { measure: entry })} />}
            {tile && tileRequest && measure && product?.retail && <TileFields profile={tile} request={tileRequest} unit={measure.unit}
              boxSize={product.retail.boxSize} pieces={requested ?? 0} disabled={frozen} update={(entry) => edit(key, { tile: entry })} />}
            {petSale && measure && product?.retail?.trackLots && <PetLotField product={product} lot={measure.lot} disabled={frozen}
              onChange={(lot) => edit(key, { measure: { ...measure, lot } })} />}
            {serials && isPurchase && <label className="timber-widths"><span>Series recibidas</span>
              <textarea rows={4} value={line.series} disabled={frozen} onChange={(event) => edit(key, { series: event.target.value })}
                placeholder="Una serie por línea" /><small>{serials.length} equipos</small></label>}
            {serials && kind === "sale" && <SerialPicker productId={line.id} selected={serials} disabled={frozen}
              choose={(selected) => edit(key, { series: selected.join("\n") })} />}
            {quote && product?.equipment && <TextField type="number" min={1} max={100} label="Equipos a cotizar" value={line.quantity}
              disabled={frozen} onChange={(event) => edit(key, { quantity: event.target.value })} />}
            {value.quote && serials && serials.length !== Number(line.quantity) && <p>Selecciona {line.quantity} series para convertir la cotización.</p>}
            {measure && requested !== undefined && unit && <p>Equivale a {equivalence(requested, unit)}</p>}
            {!isPurchase && !serials && requested !== undefined && <p><StockFeedback
              row={stockByProduct.get(line.id + (measure?.lot ? ":" + measure.lot.toUpperCase() : ""))}
              unit={unit} countUnit={bag ? "bolsas" : undefined} /></p>}
            {serials && (stockCheck.checks ?? []).filter((check) => check.productId === line.id && check.serial &&
              (!isPurchase || check.reason)).map((check) => <p key={check.serial}>
                {check.serial} · {isPurchase ? <span className="trade-issue">{check.reason}</span> : <StockFeedback row={check} />}
              </p>)}
            {isPurchase ? <TextField label={"Costo por " + (bag ? "bolsa" : measure ? unitLabels[measure.unit] : "equipo") + " (Bs)"} value={line.cost}
              inputMode="decimal" disabled={frozen} onChange={(event) => edit(key, { cost: event.target.value })} /> :
              <p>{bob(line.priceMinor)} por {line.printing ? "cara impresa" : bag ? "bolsa" : unit ? unitLabels[unit] : "equipo"}</p>}
            {changed && product && <Button variant="secondary" onClick={() => edit(key, { priceMinor: product.priceMinor })}
              disabled={frozen}>Usar precio actualizado</Button>}
            {isPurchase && product?.retail?.trackLots && <Button variant="secondary" disabled={frozen || value.lines.length >= 100} onClick={() => add(product, true)}>Añadir otro lote</Button>}
            <strong className="trade-total">Subtotal · {subtotal === null ? "Pendiente" : bob(subtotal)}</strong>
          </Card>;
        })}
        {timberLines.map((line, index) => {
          const group = timber.groups[index];
          const key = line.key ?? line.id;
          const currentRates = current.data?.[line.id]?.timber;
          const appliedRates = line.rates ?? currentRates;
          const changed = !isPurchase && !line.manualPrice?.trim() && currentRates && group.rows.some((row) => row.charged !== timberRate(currentRates, row.timber));
          const example = group.rows[0];
          return <div key={key} className="timber-trade">
            {!isPurchase && example && appliedRates && <p>Tarifa de catálogo · {bob(timberRate(currentRates ?? appliedRates, example.timber))} por pie tablar</p>}
            {changed && <Button variant="secondary" disabled={frozen} onClick={() => edit(key, { rates: currentRates })}>Usar tarifa actualizada</Button>}
            <TimberFields name={line.name} species={appliedRates?.species ?? ""} productId={line.id} capture={line.timber}
              cost={line.cost} costUnit={line.timberCostUnit} onChange={(capture) => edit(key, { timber: capture })} onCost={(cost) => edit(key, { cost })} onRemove={() => remove(key)}
              manualPrice={line.manualPrice ?? ""} onPrice={(manualPrice) => edit(key, { manualPrice })}
              onDuplicate={value.lines.length < 100 ? () => update((draft) => {
                if (draft.lines.length >= 100) return draft;
                const capture = line.timber;
                const picked = capture.selection?.timber;
                const timber = { ...capture, selection: undefined, widths: "",
                  length: picked ? displayMeasure(picked.lengthMicros, capture.units, "length") : capture.length,
                  thickness: picked ? displayMeasure(picked.thicknessMicros, capture.units, "face") : capture.thickness };
                return { ...draft, lines: [...draft.lines, { ...line, key: crypto.randomUUID(), timber }] };
              }) : undefined}
              disabled={frozen} purchase={isPurchase} rows={group.rows.map((row) => {
                const id = stockKey(line.id, row.timber);
                return { ...row, requested: timber.requested.get(id)?.quantity ?? row.quantity,
                  available: stockByMeasure.get(id) };
              })} notices={group.notices} error={group.error} total={group.total} />
          </div>;
        })}
        {value.lines.length > 0 && <p>Borrador local · {commercialGroups} de 20 grupos · {lines.length + timber.commands.length} de 100 líneas</p>}
        {invalidSeries && <Alert tone="error">Cada serie debe ser distinta. Se admiten hasta 100 por operación.</Alert>}
        {duplicateLots && <Alert tone="error">Agrupa la compra de un mismo lote en una línea.</Alert>}
        {limitReached && <Alert tone="error">Divide la operación en hasta 20 grupos y 100 líneas.</Alert>}
        {timber.problem && <Alert tone="error">{timber.problem}</Alert>}
        {stockCheck.loading && <p role="status">Consultando existencias del carrito…</p>}
        {stockCheck.error && <Alert tone="error">{stockCheck.error} <Button variant="secondary" onClick={stockCheck.retry}>Reintentar disponibilidad</Button></Alert>}
        {current.error && <Alert tone="error">{current.error} <Button variant="secondary" onClick={current.reload}>Reintentar disponibilidad</Button></Alert>}
      </Card>
    </div>
    {value.lines.length > 0 && <ReviewDock cartFocus={cart} total={totalText} operation={label[kind]} visible={!showHistory}
      description={total === null ? (isPurchase ? "Completa las cantidades y costos pendientes." : "Completa las cantidades e importes pendientes.") :
        stockCheck.loading ? "Consultando existencias…" : unavailable ? "Hay líneas que requieren revisión." : undefined}>
      {work ? <p>Cliente del trabajo · <strong>{work.customerName}</strong></p> : !isPurchase && <Buyer selected={value.customer} disabled={frozen}
        onChange={(customer) => update((draft) => ({ ...draft, customer }))} />}
      <form className="account-form" onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        void form.submit(() => ({
          kind, method: quote || stockIn ? undefined : value.method,
          customerId: isPurchase ? undefined : customerId, workLink: work ? { id: work.id, revision: work.revision } : undefined,
          discountMinor: discount ?? undefined, sourceId: value.quote, note: value.note,
          containers: containers.moves.length ? containers.moves : undefined,
          lines: [...lines.map(({ line, quantity, unitMinor, measure, serials, printing, tileRequest }): CommandLine =>
            ({ productId: line.id, quantity: measure || printing ? 1 : quantity, unitMinor, measure, serials, printing: printing?.job, tile: tileRequest })), ...timber.commands],
        }), (result) => workspace.showDocument(result.entityId), flush);
      }}>
        {withContainers && <details className="buyer"><summary>Envases entregados y devueltos</summary>
          <ContainerFields balances={containerBalances} draft={value.containers ?? {}} customer={value.customer?.id} disabled={frozen}
            update={(draft) => update((old) => ({ ...old, containers: draft }))} />
        </details>}
        {!isPurchase && <TextField label="Descuento total (Bs)" inputMode="decimal" value={value.discount} disabled={frozen}
          onChange={(event) => update((draft) => ({ ...draft, discount: event.target.value }))} />}
        {!quote && !stockIn && <PaymentField value={creditBlocked ? "" : value.method} credit={kind === "sale" && creditAllowed} disabled={frozen}
          onChange={(method) => { if (!frozen) update((draft) => ({ ...draft, method })); }} />}
        <TextField label={stockIn ? "Motivo de la entrada" : "Referencia (opcional)"} required={stockIn} maxLength={240} value={value.note} disabled={frozen}
          onChange={(event) => update((draft) => ({ ...draft, note: event.target.value }))} />
        {total === null && <Alert>Revisa las cantidades, importes y el descuento antes de confirmar.</Alert>}
        {unavailable && <Alert>Verifica disponibilidad y precios de las líneas en el carrito.</Alert>}
        {quote && stockBlocked && <Alert>Hay existencias pendientes de verificar o con faltantes. Se revisarán al convertir la cotización en venta.</Alert>}
        {discountBlocked && <Alert tone="error">El negocio permite un descuento máximo del {maxDiscount}%.</Alert>}
        {creditBlocked && <Alert tone="error">Los fiados nuevos están desactivados. Elige otra forma de pago.</Alert>}
        {quote && policy && <p className="muted">Vigencia desde la emisión · {policy.quoteDays} días</p>}
        {requiresCustomer && <Alert>El fiado requiere un cliente registrado y un importe positivo.</Alert>}
        {missingService && <Alert>Añade el servicio del trabajo antes de confirmar.</Alert>}
        {containers.error && <Alert tone="error">{containers.error}</Alert>}
        {form.error && <Alert tone="error">{form.error}</Alert>}
        {stockLines.length > 0 && (form.error || stockCheck.error) &&
          <Button variant="secondary" onClick={stockCheck.retry}>Volver a consultar existencias</Button>}
        <label className="trade-check">
          <input type="checkbox" checked={acknowledged === reviewKey} disabled={frozen || total === null}
            onChange={(event) => setAcknowledged(event.target.checked ? reviewKey : "")} />
          He revisado el importe de {totalText}
        </label>
        <Button type="submit" icon="check" disabled={!canSend || form.blocked}>Confirmar {label[kind]}</Button>
      </form>
    </ReviewDock>}
  </div>;

  return <div className="commerce-stack">
    {area ? <OperationHeading area={area} title={titles[kind]} description={area === "purchase"
      ? "Recibe mercadería y revisa los costos antes de registrar la compra."
      : "Añade productos por búsqueda o lector y revisa el cobro en el carrito."}>
      <div className="trade-controls" role="group" aria-label="Vista de la operación">
        <Button variant="secondary" icon={area === "purchase" ? "parcel" : "cart"}
          aria-pressed={!showHistory} onClick={() => setShowHistory?.(false)}>{modeTitle}</Button>
        <Button variant="secondary" icon="archive" aria-pressed={showHistory} onClick={() => setShowHistory?.(true)}>{historyTitle}</Button>
      </div>
    </OperationHeading> : <CommerceHeading title={work ? "Venta vinculada" : titles[kind]}>
      {work ? <Button variant="secondary" icon="back" onClick={onWorkBack}>Volver al trabajo</Button> :
        <div className="inline-actions">
          {onStockBack && <Button variant="secondary" icon="back" onClick={onStockBack}>Volver a inventario</Button>}
          <Button variant="secondary" icon="document" onClick={onHistory}>Ver operaciones</Button>
        </div>}
    </CommerceHeading>}
    {area && showHistory && <HistoryPage initialKind={area === "sale" ? "sales" : "purchase"} fixedTitle={historyTitle} allowExport={false} />}
    {editor}
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
      <SearchForm label="Buscar cliente por nombre o código" onSearch={(query) => { setSearch(query); setPage(1); }} />
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
  const key = [path, ids, revision, refresh].join("@");
  const [state, setState] = useState<{ key: string; data?: Record<string, Product>; error?: string }>();
  useEffect(() => {
    if (!ids) return;
    const abort = new AbortController();
    void get<Product[]>(path + "/products/batch?" + new URLSearchParams({ ids }), abort.signal)
      .then((rows) => { if (!abort.signal.aborted) setState({ key, data: Object.fromEntries(rows.map((row) => [row.id, row])) }); })
      .catch((error: unknown) => { if (!abort.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "No se pudo verificar existencias." }); });
    return () => abort.abort();
  }, [ids, key, path]);
  return { ...(state?.key === key ? state : {}), reload: () => setRefresh((previous) => previous + 1) };
}
