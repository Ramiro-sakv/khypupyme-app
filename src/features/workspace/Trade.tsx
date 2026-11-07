import { CustomerSelector } from "./CustomerSelector";
import { Panel } from "./Panel";
import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";
import { localDate, statusLabel, itemDetails } from "./format";
import { useState } from "react";
import type {
  Item,
  Method,
  ReceiptLineInput,
  ReturnInput,
  SaleLineInputV2,
  SaleV2,
  Unit,
} from "../../../shared/workspace/model";
import {
  amount,
  ceil,
  compare,
  div,
  fraction,
  mul,
  showQuantity,
  ZERO,
} from "../../../shared/workspace/exact";
import { UNITS } from "../../../shared/workspace/catalog";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { bob, cents, method, q, serials, today } from "./format";

interface CartLine {
  item: Item;
  qty: string;
  unit: Unit;
  cost: string;
  lot: string;
  expiresOn: string;
  serials: string[];
  fullBoxes: boolean;
  wastePercent: number;
}
function delivered(line: CartLine) {
  let requested = mul(q(line.qty), line.item.units[line.unit]!);
  if (line.item.kind === "ceramic" && line.unit === "m2")
    requested = mul(requested, fraction(BigInt(100 + line.wastePercent), 100n));
  if (line.item.kind === "timber-piece" || line.item.kind === "ceramic")
    requested = ceil(requested);
  if (line.item.kind === "ceramic" && line.fullBoxes)
    requested = mul(
      ceil(div(requested, line.item.units.box!)),
      line.item.units.box!,
    );
  return requested;
}
function saleInputs(lines: CartLine[]): SaleLineInputV2[] {
  return lines.map((l) => ({
    itemId: l.item.id,
    qty: q(l.qty),
    unit: l.unit,
    fullBoxes: l.fullBoxes,
    wastePercent: l.wastePercent,
    serials: l.serials,
    expectedPriceMinor: l.item.priceMinor,
  }));
}
function receiptInputs(lines: CartLine[]): ReceiptLineInput[] {
  return lines.map((l) => ({
    itemId: l.item.id,
    qty: q(l.qty),
    unit: l.unit,
    unitCostMinor: cents(l.cost),
    lot: l.lot,
    expiresOn: l.expiresOn,
    serials: l.serials,
  }));
}
export default function Trade({
  purchase = false,
  initialQuote = false,
}: {
  purchase?: boolean;
  initialQuote?: boolean;
}) {
  const { business, repository, run, busy } = useWorkspace(),
    page = useRecords<Item>("items"),
    [lines, setLines] = useState<CartLine[]>([]),
    [barcode, setBarcode] = useState(""),
    [error, setError] = useState(""),
    [isQuote, setIsQuote] = useState(initialQuote),
    [quoteId, setQuoteId] = useState(""),
    [customerName, setCustomerName] = useState(""),
    [customerId, setCustomerId] = useState(""),
    [discount, setDiscount] = useState("0"),
    [validUntil] = useState(() =>
      new Date(Date.parse(today() + "T12:00:00Z") + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    );
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
      <div className="trade-layout">
        <section className="trade-picker">
          <div className="card">
            <div className="section-heading">
              <h3>Seleccionar productos</h3>
              <Icon name="box" />
            </div>
            <ActionForm
              disabled={busy}
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
                  <button key={item.id} onClick={() => addItem(item)}>
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
          disabled={busy || !lines.length}
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
              result = await run({
                kind: "purchase",
                input: {
                  lines: receiptInputs(lines),
                  method: method(d),
                  date: String(d.get("date")),
                  reference: String(d.get("reference") ?? ""),
                },
              });
            else if (isQuote)
              result = await run({
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
              result = await run({
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
              setLines([]);
              setQuoteId("");
              setDiscount("0");
              if (initialQuote) setIsQuote(true);
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
              />
            ) : (
              <>
                <Field name="date" label="Fecha" type="date" value={today()} />
                <MethodField credit={!purchase} />
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
            setQuoteId(quote.id);
            setIsQuote(false);
          }}
        />
      )}
      {purchase ? <PurchaseHistory /> : !initialQuote ? <SalesHistory /> : null}
    </>
  );
}
function CartEditor({
  line,
  update,
  remove,
  purchase,
  quote = false,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
  quote?: boolean;
}) {
  const available = useRecords<{ id: string; serial: string }>(
    "serials",
    { itemId: line.item.id, status: "available" },
    line.item.kind === "appliance" && !purchase && !quote,
  );
  let coverage: string;
  try {
    coverage = `Entrega: ${showQuantity(delivered(line))} ${line.item.baseUnit}`;
    if (line.item.kind === "ceramic")
      coverage += ` · Cobertura real ${showQuantity(div(delivered(line), line.item.units.m2!))} m²`;
  } catch {
    coverage = "Revisa la cantidad.";
  }
  return (
    <section className="card cart-line">
      <h3>{line.item.name}</h3>
      <p className="muted">{itemDetails(line.item)}</p>
      <div className="workspace-grid">
        <label>
          Cantidad solicitada
          <input
            value={line.qty}
            onChange={(e) => update({ qty: e.target.value })}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          Unidad
          <select
            value={line.unit}
            onChange={(e) => update({ unit: e.target.value as Unit })}
          >
            {Object.keys(line.item.units).map((u) => (
              <option key={u} value={u}>
                {UNITS[u as Unit]}
              </option>
            ))}
          </select>
        </label>
        {purchase && (
          <label>
            Costo por unidad elegida (BOB)
            <input
              value={line.cost}
              onChange={(e) => update({ cost: e.target.value })}
              required
              inputMode="decimal"
            />
          </label>
        )}
      </div>
      {purchase && (
        <>
          <label>
            Lote
            <input
              value={line.lot}
              onChange={(e) => update({ lot: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Vencimiento (si corresponde)
            <input
              type="date"
              value={line.expiresOn}
              onChange={(e) => update({ expiresOn: e.target.value })}
            />
          </label>
        </>
      )}
      {!purchase && line.item.kind === "ceramic" && (
        <>
          <label>
            Merma al cotizar por m² (%)
            <input
              type="number"
              min={0}
              max={30}
              step="1"
              value={line.wastePercent}
              onChange={(e) => update({ wastePercent: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={line.fullBoxes}
              onChange={(e) => update({ fullBoxes: e.target.checked })}
            />
            Entregar solamente cajas completas
          </label>
        </>
      )}
      {line.item.kind === "appliance" &&
        (purchase ? (
          <label>
            Una serie por equipo (líneas o comas)
            <textarea
              value={line.serials.join("\n")}
              onChange={(e) => update({ serials: serials(e.target.value) })}
            />
          </label>
        ) : (
          !quote && (
            <>
              <p>Selecciona cada unidad que se entrega.</p>
              <Pager page={available} />
              {available.items.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={line.serials.includes(s.id)}
                    onChange={(e) =>
                      update({
                        serials: e.target.checked
                          ? [...line.serials, s.id]
                          : line.serials.filter((id) => id !== s.id),
                      })
                    }
                  />
                  {s.serial}
                </label>
              ))}
            </>
          )
        ))}
      {!purchase && (
        <p>
          {coverage} · Precio {bob(line.item.priceMinor)} /{" "}
          {UNITS[line.item.priceUnit]}
        </p>
      )}
      <button type="button" onClick={remove}>
        Quitar línea
      </button>
    </section>
  );
}
interface Quote {
  customerId: string;
  id: string;
  number: string;
  validUntil: string;
  customerName: string;
  discountMinor: number;
  lines: SaleLineInputV2[];
}
function Quotes({
  onConvert,
}: {
  onConvert: (q: {
    customerId: string;
    id: string;
    customerName: string;
    discountMinor: number;
    lines: (Omit<SaleLineInputV2, "qty"> & { item: Item; qty: string })[];
  }) => void;
}) {
  const page = useRecords<Quote>("quotes"),
    { business, repository } = useWorkspace(),
    [error, setError] = useState("");
  return (
    <details>
      <summary>Cotizaciones anteriores</summary>
      <Pager page={page} />
      {error && <p role="alert">{error}</p>}
      {page.items.map((row) => (
        <article className="card" key={row.id}>
          {row.number} · {row.customerName} · vigente hasta{" "}
          {localDate(row.validUntil)}
          <button
            onClick={() => {
              void (async () => {
                try {
                  const lines = await Promise.all(
                    row.lines.map(async (l) => {
                      const item = (
                        await repository.list<Item>({
                          apiVersion: 2,
                          businessId: business.id,
                          resource: "items",
                          id: l.itemId,
                        })
                      ).items[0];
                      if (!item) throw new Error("Producto no disponible.");
                      return { ...l, item, qty: showQuantity(l.qty) };
                    }),
                  );
                  onConvert({ ...row, lines });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No se pudo cargar.",
                  );
                }
              })();
            }}
          >
            Revisar y convertir a venta
          </button>
        </article>
      ))}
    </details>
  );
}
function PurchaseHistory() {
  const page = useRecords<{
      id: string;
      number: string;
      date: string;
      totalMinor: number;
      lines: { name: string; qty: { n: string; d: string }; unit: Unit }[];
    }>("purchasesV2"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [product, setProduct] = useState(""),
    products = useRecords<Item>("items");
  const filtered = useRecords<{
    id: string;
    number: string;
    totalMinor: number;
  }>("purchasesV2", {
    ...(from && to ? { from, to } : {}),
    ...(product ? { itemId: product } : {}),
  });
  return (
    <details>
      <summary>Compras registradas</summary>
      <label>
        Desde
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        Hasta
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label>
        Producto
        <select value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">Todos</option>
          {products.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <Pager page={products} />
      <Pager page={filtered} />
      {filtered.items.map((p) => (
        <p key={p.id}>
          {p.number} · {bob(p.totalMinor)}
        </p>
      ))}
      <details>
        <summary>Detalle de productos de la página reciente</summary>
        {page.items.map((p) => (
          <p key={p.id}>
            {p.number}:{" "}
            {p.lines
              .map((l) => `${l.name} ${showQuantity(l.qty)} ${UNITS[l.unit]}`)
              .join(" / ")}
          </p>
        ))}
      </details>
    </details>
  );
}
export function SalesHistory() {
  const page = useRecords<SaleV2>("salesV2"),
    [sale, setSale] = useState<SaleV2 | null>(null);
  return (
    <>
      <h2>Ventas y devoluciones</h2>
      <Pager page={page} />
      <div className="table-scroll desktop-records">
        <table>
          <thead>
            <tr>
              <th>Venta</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th className="numeric">Importe</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.number}</strong>
                  <small>{localDate(s.date)}</small>
                </td>
                <td>{s.customerName || "Cliente ocasional"}</td>
                <td>
                  <span className="badge" data-state={s.status}>
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td className="numeric">{bob(s.totalMinor)}</td>
                <td>
                  <button onClick={() => setSale(s)}>
                    Detalle y devolución
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-records">
        {page.items.map((s) => (
          <article className="card" key={s.id}>
            <strong>
              {s.number} · {bob(s.totalMinor)}
            </strong>
            <p>
              {localDate(s.date)} · {s.customerName || "Cliente ocasional"} ·{" "}
              <span className="badge" data-state={s.status}>
                {statusLabel(s.status)}
              </span>
            </p>
            <button onClick={() => setSale(s)}>
              Detalle / devolver / cambiar
            </button>
          </article>
        ))}
      </div>
      {sale && (
        <ReturnForm key={sale.id} sale={sale} close={() => setSale(null)} />
      )}
    </>
  );
}
function ReturnForm({ sale, close }: { sale: SaleV2; close: () => void }) {
  const { run, busy } = useWorkspace(),
    [selected, setSelected] = useState<
      Record<number, { qty: string; restock: boolean; serials: string[] }>
    >({}),
    [exchange, setExchange] = useState(false),
    [replacements, setReplacements] = useState<CartLine[]>([]),
    items = useRecords<Item>("items");
  return (
    <Panel title={sale.number + " · Devoluciones y cambios"} onClose={close}>
      <ActionForm
        disabled={busy}
        label={exchange ? "Confirmar cambio atómico" : "Confirmar devolución"}
        onSave={async (d) => {
          const lines: ReturnInput[] = Object.entries(selected)
            .filter(([, v]) => v.qty && compare(q(v.qty), ZERO) > 0)
            .map(([i, v]) => ({
              line: Number(i),
              qty: q(v.qty),
              unit: String(d.get("returnUnit" + i)) as Unit,
              restock: v.restock,
              serials: v.serials,
            }));
          let result;
          if (exchange) {
            if (!replacements.length)
              throw new Error("Selecciona los productos nuevos.");
            result = await run({
              kind: "exchange",
              input: {
                saleId: sale.id,
                returns: lines,
                lines: saleInputs(replacements),
                reason: String(d.get("reason")),
                method: method(d),
                customerName: sale.customerName,
              },
            });
          } else
            result = await run({
              kind: "return",
              input: {
                saleId: sale.id,
                lines,
                reason: String(d.get("reason")),
                method: method(d),
              },
            });
          if (result) close();
        }}
      >
        {sale.lines.map((l, i) => {
          const value = selected[i] ?? { qty: "", restock: true, serials: [] };
          return (
            <div key={i}>
              <strong>
                {l.name} · vendido {showQuantity(l.delivered)} {l.baseUnit} · ya
                devuelto {showQuantity(l.returned)}
              </strong>
              <label>
                Cantidad a devolver
                <input
                  value={value.qty}
                  onChange={(e) =>
                    setSelected((old) => ({
                      ...old,
                      [i]: { ...value, qty: e.target.value },
                    }))
                  }
                  inputMode="decimal"
                />
              </label>
              <label>
                Unidad original
                <select
                  name={"returnUnit" + i}
                  defaultValue={
                    Object.entries(l.units).find(
                      ([unit, factor]) =>
                        factor?.n === "1" &&
                        factor.d === "1" &&
                        ["piece", "pair", "bag", "service"].includes(unit),
                    )?.[0] ?? l.requestedUnit
                  }
                >
                  {Object.keys(l.units).map((unit) => (
                    <option key={unit} value={unit}>
                      {UNITS[unit as Unit]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={value.restock}
                  onChange={(e) =>
                    setSelected((old) => ({
                      ...old,
                      [i]: { ...value, restock: e.target.checked },
                    }))
                  }
                />
                Reingresa al inventario{" "}
                {l.kind === "appliance" ? "(en inspección)" : ""}
              </label>
              {l.kind === "appliance" &&
                l.allocations
                  .filter((a) => a.returned.n === "0")
                  .map((a) => (
                    <label key={a.stockId}>
                      <input
                        type="checkbox"
                        checked={value.serials.includes(a.stockId)}
                        onChange={(e) =>
                          setSelected((old) => ({
                            ...old,
                            [i]: {
                              ...value,
                              serials: e.target.checked
                                ? [...value.serials, a.stockId]
                                : value.serials.filter(
                                    (id) => id !== a.stockId,
                                  ),
                            },
                          }))
                        }
                      />
                      {a.serial}
                    </label>
                  ))}
            </div>
          );
        })}
        <label>
          <input
            type="checkbox"
            checked={exchange}
            onChange={(e) => setExchange(e.target.checked)}
          />
          Combinar con nueva venta como cambio
        </label>
        {exchange && (
          <>
            <Pager page={items} />
            <label>
              Agregar producto nuevo
              <select
                value=""
                onChange={(e) => {
                  const item = items.items.find((i) => i.id === e.target.value);
                  if (
                    item &&
                    !replacements.some((l) => l.item.id === item.id) &&
                    replacements.length < 20
                  )
                    setReplacements((old) => [
                      ...old,
                      {
                        item,
                        qty: "1",
                        unit: item.priceUnit,
                        cost: "",
                        lot: "",
                        expiresOn: "",
                        serials: [],
                        fullBoxes: false,
                        wastePercent: 0,
                      },
                    ]);
                }}
              >
                <option value="">Seleccionar</option>
                {items.items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {bob(i.priceMinor)}/{UNITS[i.priceUnit]}
                    </option>
                  ))}
              </select>
            </label>
            {replacements.map((line, index) => (
              <CartEditor
                key={line.item.id}
                line={line}
                purchase={false}
                update={(patch) =>
                  setReplacements((old) =>
                    old.map((l, i) => (i === index ? { ...l, ...patch } : l)),
                  )
                }
                remove={() =>
                  setReplacements((old) => old.filter((_, i) => i !== index))
                }
              />
            ))}
            <p>
              La caja registra solamente la diferencia entre devolución y nueva
              venta.
            </p>
          </>
        )}
        <Field name="reason" label="Motivo" maxLength={200} />
        <MethodField />
        <p>
          Se restituye el costo histórico. Los equipos reingresados quedan en
          inspección.
        </p>
      </ActionForm>
    </Panel>
  );
}
