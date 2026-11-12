import type { IndustryId } from "../../../shared/business-industries";
import { UNITS, itemMeasure } from "../../../shared/workspace/catalog";
import { div } from "../../../shared/workspace/exact";
import { displayQuantity } from "../../../shared/workspace/presentation";
import { hasSerialWorkflow, hasVariantMatrix } from "../../../shared/workspace/industry-capabilities";
import type { Item } from "../../../shared/workspace/model";
import type { TimberSystem } from "../../../shared/workspace/timber-measures";
import { bob, itemDetails } from "./format";
import { Icon } from "./Icon";

function groupLabel(industry: IndustryId | null, item: Item): string {
  if (industry === "appliances" || industry === "electronics") {
    if (item.kind === "service") return "Servicios";
    return item.kind === "appliance" ? "Equipos por serie" : "Accesorios por cantidad";
  }
  if (industry === "cement") return item.kind === "cement-bag" ? "Bolsas" : item.kind === "cement-bulk" ? "Granel" : "Otros productos";
  if (industry === "pets") return itemMeasure(item) === "mass" ? "Fraccionados por peso" : "Envasados y otros productos";
  if (industry === "stationery") return item.kind === "service" ? "Impresión y servicios" : "Artículos";
  if (industry === "furniture") return item.kind === "service" ? "Armado y servicios" : "Piezas terminadas";
  if (industry === "crafts") return item.kind === "service" ? "Servicios" : "Piezas listas";
  if (industry === "beauty") return item.kind === "service" ? "Servicios de atención" : "Productos";
  if (industry === "repair") return item.kind === "service" ? "Mano de obra" : "Repuestos";
  return "";
}

export function TradeProductPicker({ items, industry, timberSystem, disabled, purchase, onPick }: {
  items: Item[];
  industry: IndustryId | null;
  timberSystem: TimberSystem;
  disabled: boolean;
  purchase: boolean;
  onPick: (item: Item) => void;
}) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.active || (purchase && item.kind === "service") || (hasVariantMatrix(industry) && item.kind === "apparel")) continue;
    const label = groupLabel(industry, item);
    const group = groups.get(label);
    if (group) group.push(item);
    else groups.set(label, [item]);
  }

  const firstGroup = industry === "appliances" ? "Equipos por serie"
    : industry === "electronics" ? "Accesorios por cantidad"
    : industry === "cement" ? "Bolsas"
    : industry === "beauty" ? "Servicios de atención" : "";
  const ordered = [...groups].sort(([a], [b]) => Number(b === firstGroup) - Number(a === firstGroup));
  return <div className="trade-product-groups">
    {ordered.map(([label, products]) => <div key={label} className="trade-product-group">
      {label && <h4>{label}</h4>}
      <div className="product-picker">
        {products.map((item) => {
          const details = itemDetails(item, timberSystem);
          const factor = item.units[item.priceUnit];
          const stock = item.kind !== "service" && factor
            ? `${displayQuantity(div(item.balance, factor))} ${UNITS[item.priceUnit]}` : "";
          return <button type="button" className="trade-product" data-item-kind={item.kind}
            disabled={disabled} data-tutorial="pick-item" data-item-id={item.id} key={item.id} onClick={() => onPick(item)}>
            <span className="trade-product-name"><strong>{item.name}</strong><Icon name="plus" /></span>
            {details && <small>{details}</small>}
            {industry === "spareParts" && !item.details?.profile?.vehicleMake && !item.details?.compatibility && <small>Compatibilidad por confirmar</small>}
            <span className="trade-product-values">
              <b>{bob(item.priceMinor)} <small>/ {UNITS[item.priceUnit]}</small></b>
              {stock && <small>Existencia · {stock}</small>}
            </span>
            {hasSerialWorkflow(industry) && item.kind === "appliance" && <span className="badge">Por serie</span>}
          </button>;
        })}
      </div>
    </div>)}
  </div>;
}
