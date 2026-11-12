import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import { useState } from "react";
import TimberFixedLineEditor from "./TimberFixedLineEditor";
import TimberLineEditor from "./TimberLineEditor";
import { UNITS } from "../../../shared/workspace/catalog";
import { compare, div, showQuantity as showExact } from "../../../shared/workspace/exact";
import type { Quantity } from "../../../shared/workspace/exact";
import type { Unit } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, itemDetails, measuredText, serials } from "./format";
import { Pager } from "./ui";

import type { CartLine } from "./Cart";
import { delivered, linePrice } from "./Cart";
import SerialReceipt from "./SerialReceipt";
export default function CartEditor({
  line,
  update,
  remove,
  purchase,
  quote = false,
  fixedSerialQuantity = false,
  duplicate,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
  quote?: boolean;
  fixedSerialQuantity?: boolean;
  duplicate?: (() => void) | undefined;
}) {
  const { business } = useWorkspace();
  const guidedSerials = business.industryId === "appliances" && line.item.kind === "appliance" && !quote;
  const [seriesInput, setSeriesInput] = useState("");
  const [seriesQuery, setSeriesQuery] = useState("");
  const retail = business.industryId === "convenience" && ["general", "grocery"].includes(line.item.kind);
  const retailStock = useRecords<{ id: string; balance: Quantity }>(
    "saleAvailability", { id: line.item.id }, retail && !purchase && !quote,
  );
  const available = useRecords<{ id: string; serial: string }>(
    "serials",
    { itemId: line.item.id, status: "available", ...(guidedSerials && seriesQuery ? { serialNumber: seriesQuery } : {}) },
    line.item.kind === "appliance" && !purchase && !quote,
  );
  if (line.item.kind === "timber-grouped")
    return (
      <TimberLineEditor
        line={line}
        update={update}
        remove={remove}
        purchase={purchase}
        duplicate={duplicate}
      />
    );
  if (line.item.kind === "timber-piece")
    return (
      <TimberFixedLineEditor
        line={line}
        update={update}
        remove={remove}
        purchase={purchase}
      />
    );
  let coverage: string, insufficient = false;
  const price = linePrice(line, purchase);
  try {
    const quantity = delivered(line);
    const measured = measuredText(line.item, quantity, line.unit);
    coverage = `${purchase ? "Ingreso" : "Entrega"}: ${measured ?? `${showQuantity(quantity)} ${line.item.baseUnit}`}`;
    if (measured && line.unit !== line.item.priceUnit) coverage += ` · ${measuredText(line.item, quantity)}`;
    if (retailStock.items[0]) insufficient = compare(quantity, retailStock.items[0].balance) > 0;
    if (line.item.kind === "ceramic")
      coverage += ` · Cobertura real ${showQuantity(div(delivered(line), line.item.units.m2!))} m²`;
  } catch {
    coverage = "Revisa la cantidad.";
  }
  return (
    <section className="card cart-line" data-item-kind={line.item.kind}>
      <h3>{line.item.name}</h3>
      <p className="muted">
        {itemDetails(line.item, business.timberSystem ?? "imperial")}
      </p>
      {guidedSerials && <p className="notice">{purchase ? "Series que ingresan al inventario" : "Series disponibles para entregar"}</p>}
      <div className="workspace-grid">
        {!guidedSerials && <label>
          Cantidad solicitada
          <input
            name="line-qty"
            value={line.qty}
            onChange={(e) => update({ qty: e.target.value })}
            inputMode="decimal"
            required
          />
        </label>}
        {!guidedSerials && <label>
          Unidad
          <select
            name="line-unit"
            value={line.unit}
            onChange={(e) => update({ unit: e.target.value as Unit })}
          >
            {Object.keys(line.item.units).map((u) => (
              <option key={u} value={u}>
                {UNITS[u as Unit]}
              </option>
            ))}
          </select>
        </label>}
        {purchase && (
          <label>
            Costo por unidad elegida (BOB)
            <input
              name="line-cost"
              value={line.cost}
              onChange={(e) => update({ cost: e.target.value })}
              required
              inputMode="decimal"
            />
          </label>
        )}
      </div>
      {["g", "mL"].includes(line.item.baseUnit) && line.item.units[line.unit] && (
        <small>1 {UNITS[line.unit]} = {showExact(line.item.units[line.unit]!)} {line.item.baseUnit}</small>
      )}
      {purchase && (retail || ["g", "mL"].includes(line.item.baseUnit)) && (
        <p className="notice">{coverage}{line.unit === "box" && line.item.units.box && ` · ${showQuantity(line.item.units.box)} ${line.item.baseUnit} por caja`}</p>
      )}
      {retail && !purchase && !quote && (
        <div role={retailStock.error || insufficient ? "alert" : "status"} className={insufficient ? "notice notice-warning" : "notice"}>
          {retailStock.loading ? "Consultando disponibilidad…" : retailStock.error || (retailStock.items[0]
            ? `Disponible para vender: ${measuredText(line.item, retailStock.items[0].balance, line.unit) ?? `${showQuantity(retailStock.items[0].balance)} ${line.item.baseUnit}`}${insufficient ? " · reduce la cantidad o registra una compra" : ""}.`
            : "Este producto ya no está disponible.")}
          {retailStock.error && <button type="button" onClick={retailStock.first}>Volver a consultar</button>}
        </div>
      )}
      {purchase && !guidedSerials && (
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
        (purchase ? guidedSerials ? <SerialReceipt value={line.serials} update={update} /> : (
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
              <p>Selecciona cada unidad que se entrega.{guidedSerials && ` ${line.serials.length}${fixedSerialQuantity ? ` de ${line.qty}` : ""} seleccionadas.`}</p>
              {guidedSerials && <div className="series-search">
                <label>Buscar serie disponible
                  <input value={seriesInput} maxLength={80} autoComplete="off" onChange={(event) => setSeriesInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSeriesQuery(seriesInput.trim()); } }} />
                </label>
                <div className="actions">
                  <button type="button" onClick={() => setSeriesQuery(seriesInput.trim())}>Buscar serie</button>
                  {seriesQuery && <button type="button" onClick={() => { setSeriesInput(""); setSeriesQuery(""); }}>Ver todas</button>}
                  {line.serials.length > 0 && <button type="button" onClick={() => update({ serials: [], ...(!fixedSerialQuantity ? { qty: "0" } : {}) })}>Limpiar selección</button>}
                </div>
              </div>}
              <Pager page={available} />
              {available.items.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={line.serials.includes(s.id)}
                    disabled={guidedSerials && fixedSerialQuantity && line.serials.length >= Number(line.qty) && !line.serials.includes(s.id)}
                    onChange={(e) => {
                      const selected = e.target.checked ? [...line.serials, s.id] : line.serials.filter((id) => id !== s.id);
                      update({ serials: selected, ...(guidedSerials && !fixedSerialQuantity ? { qty: String(selected.length) } : {}) });
                    }}
                  />
                  {s.serial}
                </label>
              ))}
            </>
          )
        ))}
      {!purchase && <p>{coverage}</p>}
      <p className="cart-line-price" role="status">
        {"issue" in price ? price.issue : <>
          <span>{purchase ? "Costo" : "Precio"} {bob(price.unitMinor)} / {UNITS[price.unit]}</span>
          <strong>Subtotal {bob(price.subtotal)}</strong>
        </>}
      </p>
      <button type="button" onClick={remove}>
        Quitar línea
      </button>
    </section>
  );
}
