import { useState } from "react";
import type { components } from "../api/schema";
import { Alert, Button, Card, DataTable, SelectField } from "../ui/Primitives";
import { fromBase, productAvailability, quantityLabel, unitLabels } from "../retail/measures";
import type { Serial } from "../retail/measures";
import { serialStates, UnitDetails } from "../retail/SerialHistory";
import { measuredIndustry } from "../retail/ProductFields";
import { CompatibilityFilter, emptyVehicle, searchLabel, SpecialtySummary, vehicleQuery } from "../retail/SpecialtyFields";
import { timberLabel } from "../timber/measures";
import type { TimberUnits } from "../timber/measures";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { LoadFeedback, NoRecords, Pages, SearchForm } from "./CommerceUi";
import { bob, dateLabel, documentName } from "./models";
import type { Page, Product } from "./models";

type WarehouseItem = components["schemas"]["WarehouseItem"];
type Movement = components["schemas"]["StockMovement"];
const states: Record<string, string> = { available: "Disponible", empty: "Sin stock", unavailable: "No vendible" };

export function Warehouse({ industry, focus, open, openBags }: {
  industry?: string; focus?: string; open: (product: Product) => void; openBags?: (product: Product) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(focus && Object.hasOwn(states, focus) ? focus : "");
  const measured = measuredIndustry(industry);
  const [attention, setAttention] = useState(measured && focus && ["reorder", "expiring", "expired", "held"].includes(focus) ? focus : "");
  const [vehicle, setVehicle] = useState(emptyVehicle);
  const searchTitle = industry === "cosmetics" ? "Buscar por marca, presentación o tono" :
    ["hardware", "spareParts"].includes(industry ?? "") ? searchLabel(industry) : "Buscar en Almacén por nombre o código";
  const result = useCommerceData<Page<WarehouseItem>>("/warehouse?" + new URLSearchParams({ search, page: String(page),
    ...(status && { status }), ...(attention && { attention }), ...(industry === "spareParts" ? vehicleQuery(vehicle) : {}) }));

  return <Card className="inventory-table">
    <h2>Almacén</h2>
    <div className="inventory-controls">
      <SearchForm instant label={searchTitle} onSearch={(query) => { setSearch(query); setPage(1); }} />
      <SelectField label="Disponibilidad" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
        <option value="">Todos los estados</option>
        {Object.entries(states).map(([id, name]) => <option value={id} key={id}>{name}</option>)}
      </SelectField>
      {measured && <SelectField label="Atención en almacén" value={attention}
        onChange={(event) => { setAttention(event.target.value); setPage(1); }}>
        <option value="">Todos</option><option value="reorder">Reposición</option><option value="expiring">Próximo a vencer</option>
        <option value="expired">Lotes vencidos</option><option value="held">Lotes apartados</option>
      </SelectField>}
    </div>
    {industry === "spareParts" && <CompatibilityFilter onChange={(filter) => { setVehicle(filter); setPage(1); }} />}
    {!result.data ? <LoadFeedback {...result} /> : !result.data.items.length ? <NoRecords>No hay productos que coincidan con esta búsqueda.</NoRecords> :
      <DataTable caption="Existencias del almacén" columns={["Producto", "Estado", "Saldo vendible", "Valor a costo", "Acción"]}
        rows={result.data.items.map(({ product, status }) => ({ id: product.id, cells: [
          <div>{product.name}<small className="record-secondary">{product.code}{product.timber && " · " + product.timber.species}
            {product.apparel && " · " + [product.apparel.model, product.apparel.size, product.apparel.color].join(" · ")}</small>
            {product.cosmetic && <small className="record-secondary">{[product.cosmetic.brand, product.cosmetic.presentation, product.cosmetic.tone].filter(Boolean).join(" · ")}</small>}
            {product.cosmetic?.afterOpeningMonths && <small className="record-secondary">{product.cosmetic.afterOpeningMonths} meses tras apertura</small>}
            <SpecialtySummary product={product} />
            {industry === "spareParts" && !product.specialty?.parts && <small>Compatibilidad por confirmar</small>}
          </div>,
          <span className="status-chip" data-state={status === "available" ? "open" : status}>{states[status]}</span>,
          status !== "available" ? "—" : <div>{productAvailability(product)}
            {product.retail?.unit === "piece" && product.retail.boxSize > 1 &&
              <small className="record-secondary">Caja de {product.retail.boxSize} unidades</small>}</div>,
          bob(product.valueMinor),
          <div className="inline-actions">
            <Button variant="secondary" onClick={() => open(product)}>Ver existencias</Button>
            {openBags && status === "available" && product.specialty?.material?.cement?.bulkProductId &&
              <Button variant="secondary" onClick={() => openBags(product)}>Abrir bolsas</Button>}
          </div>,
        ] }))} />}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </Card>;
}

export function StockMovements({ product, units }: { product: Product; units: TimberUnits }) {
  const [page, setPage] = useState(1);
  const { showDocument } = useCommerce();
  const result = useCommerceData<Page<Movement>>("/warehouse/" + product.id + "/movements?page=" + page);
  const blocked = product.retail && product.measuredStock != null && product.sellableStock != null &&
    product.measuredStock > product.sellableStock;
  return <Card>
    {blocked && <Alert>Parte del saldo físico está vencida o apartada. Consulta el estado de cada lote.</Alert>}
    <h2>Movimientos de {product.name}</h2>
    {!result.data ? <LoadFeedback {...result} /> : !result.data.items.length ? <NoRecords>No hay movimientos registrados para este producto.</NoRecords> :
      <DataTable caption="Historial del producto" columns={["Fecha", "Operación", "Cantidad", "Motivo o referencia", "Comprobante"]}
        rows={result.data.items.map((row, index) => ({
          id: row.entryId + "-" + index, cells: [
            dateLabel(row.date), documentName(row.kind),
            <div>{row.details?.baseQuantity != null && product.retail ?
              quantityLabel(fromBase(row.details.baseQuantity, product.retail.unit)) + " " + unitLabels[product.retail.unit] : row.quantity}
              {row.timber && <small className="record-secondary">{timberLabel(row.timber, units)}</small>}
              {row.details?.serial && <small className="record-secondary">{row.details.serial}</small>}
              {row.kind === "open-cement" && <small className="record-secondary">
                {row.details?.direction === "bulk-entry" ? "Entrada a granel" : "Salida de bolsas"}
              </small>}
              {row.kind === "return" && row.restocked === false && <small className="record-secondary">Sin reingreso a stock</small>}
            </div>,
            row.note || "—", <Button variant="secondary" onClick={() => showDocument(row.entryId)}>{row.number}</Button>,
          ],
        }))} />}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </Card>;
}

export function WarehouseSerials({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const [serial, setSerial] = useState("");
  const [state, setState] = useState("");
  const result = useCommerceData<Page<Serial>>("/serials?" + new URLSearchParams({ product: product.id, page: String(page), ...(state && { state }) }));
  return <Card>
    <h2>Unidades por número de serie</h2>
    {serial && <UnitDetails key={serial} serial={serial} close={() => setSerial("")} />}
    <SelectField label="Estado de la unidad" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}>
      <option value="">Todos</option>
      {Object.entries(serialStates).map(([id, name]) => <option value={id} key={id}>{name}</option>)}
    </SelectField>
    {!result.data ? <LoadFeedback {...result} /> : !result.data.items.length ? <NoRecords>No hay números de serie para este estado.</NoRecords> :
      <DataTable caption={"Series de " + product.name} columns={["Serie", "Estado", "Garantía", "Acción"]}
        rows={result.data.items.map((item) => ({ id: item.serial, cells: [item.serial, serialStates[item.state],
          item.warrantyUntil ? dateLabel(item.warrantyUntil) : "—",
          <Button variant="secondary" onClick={() => setSerial(item.serial)}>Ver historial</Button>,
        ] }))} />}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </Card>;
}
