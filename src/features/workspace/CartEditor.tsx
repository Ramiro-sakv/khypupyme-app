import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import { useState } from "react";
import TimberFixedLineEditor from "./TimberFixedLineEditor";
import TimberLineEditor from "./TimberLineEditor";
import { UNITS } from "../../../shared/workspace/catalog";
import { div, sub, showQuantity as showExact } from "../../../shared/workspace/exact";
import type { CartStock } from "../../../shared/workspace/availability";
import { StockNumbers } from "./StockNumbers";
import type { Unit } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, itemDetails, measuredText, q, serials } from "./format";
import { Pager } from "./ui";

import { hasSerialWorkflow, quickCatalog } from "../../../shared/workspace/industry-capabilities";
import type { CartLine } from "./Cart";
import { delivered, linePrice } from "./Cart";
import { PackageQuantity, PrintQuantity } from "./TradeLineOptions";
import SerialReceipt from "./SerialReceipt";
export default function CartEditor({
  line,
  update,
  remove,
  purchase,
  quote = false,
  fixedSerialQuantity = false,
  duplicate,
  stock,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
  quote?: boolean;
  fixedSerialQuantity?: boolean;
  duplicate?: (() => void) | undefined;
  stock?: CartStock | undefined;
}) {
  const { business } = useWorkspace();
  const guidedSerials = hasSerialWorkflow(business.industryId) && line.item.kind === "appliance" && !quote;
  const [seriesInput, setSeriesInput] = useState("");
  const [seriesQuery, setSeriesQuery] = useState("");
  const retail = quickCatalog(business.industryId) && ["general", "grocery"].includes(line.item.kind);
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
        availability={stock}
      />
    );
  if (line.item.kind === "timber-piece")
    return (
      <TimberFixedLineEditor
        line={line}
        update={update}
        remove={remove}
        purchase={purchase}
        stock={stock?.checks[0]}
      />
    );
  let coverage: string;
  const price = linePrice(line, purchase);
  const stockUnit = line.item.kind === "ceramic" && line.fullBoxes ? "box" : line.unit;
  const canPackage = !purchase && business.industryId === "beverages" && line.item.baseUnit === "piezas" && !!line.item.units.box;
  const canPrint = !purchase && business.industryId === "stationery" && line.item.kind === "service" &&
    !!line.item.details?.profile?.printSize && !!line.item.details.profile.printInk;
  try {
    const quantity = delivered(line);
    const measured = measuredText(line.item, quantity, line.unit);
    coverage = `${purchase ? "Ingreso" : "Entrega"}: ${measured ?? `${showQuantity(quantity)} ${line.item.baseUnit}`}`;
    if (measured && line.unit !== line.item.priceUnit) coverage += ` · ${measuredText(line.item, quantity)}`;
    if (line.item.kind === "ceramic") {
      const surface = div(quantity, line.item.units.m2!);
      const requested = line.unit === "m2" ? q(line.qty) : surface;
      const boxes = div(quantity, line.item.units.box!);
      coverage += ` · ${line.fullBoxes ? showQuantity(boxes) + " cajas · " : ""}Cobertura ${showQuantity(surface)} m² · excedente ${showQuantity(sub(surface, requested))} m²`;
    }
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
      {canPackage && <PackageQuantity line={line} update={update} />}
      {canPrint && <PrintQuantity line={line} update={update} />}
      <div className="workspace-grid">
        {!guidedSerials && !canPackage && !canPrint && <label>
          Cantidad solicitada
          <input
            name="line-qty"
            value={line.qty}
            onChange={(e) => update({ qty: e.target.value })}
            inputMode="decimal"
            required
          />
        </label>}
        {!guidedSerials && !canPackage && !canPrint && <label>
          Unidad
          <select
            name="line-unit"
            value={line.unit}
            onChange={(e) => update({ unit: e.target.value as Unit })}
          >
            {Object.keys(line.item.units).filter((unit) => purchase || unit !== "roll").map((u) => (
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
      {["g", "mL", "m"].includes(line.item.baseUnit) && line.item.units[line.unit] && (
        <small>1 {UNITS[line.unit]} = {showExact(line.item.units[line.unit]!)} {line.item.baseUnit}</small>
      )}
      {purchase && (retail || ["g", "mL", "m"].includes(line.item.baseUnit)) && (
        <p className="notice">{coverage}{line.unit === "box" && line.item.units.box && ` · ${showQuantity(line.item.units.box)} ${line.item.baseUnit} por caja`}</p>
      )}
      {stock?.checks[0] && <StockNumbers check={stock.checks[0]} factor={line.item.units[stockUnit]} unit={UNITS[stockUnit]} />}
      {stock?.issue && <p className="notice notice-warning" role="status">{stock.issue}</p>}
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
