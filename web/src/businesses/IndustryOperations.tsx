import { useCommerceData } from "../commerce/CommerceContext";
import type { components } from "../api/schema";
import { measuredIndustry, equipmentIndustry } from "../retail/ProductFields";
import { workNavigation } from "../services/work";
import { Alert, Button } from "../ui/Primitives";
import { Icon } from "../ui/Icon";
import type { BusinessView } from "./BusinessWorkspace";
import { operationsFor } from "./industryWorkflows";
import { usesDeliveries } from "./industryThemes";

type Link = (view: BusinessView, focus?: string) => void;
type Metric = { label: string; count?: number; view: BusinessView; focus?: string; warning?: boolean };

export function IndustryOperations({ industry, open, lotDays = 30 }: { industry: string; open: Link; lotDays?: number }) {
  const operations = operationsFor(industry);
  const hasLots = measuredIndustry(industry);
  const hasEquipment = equipmentIndustry(industry);
  const hasWork = !!workNavigation[industry];
  const hasDelivery = usesDeliveries(industry);
  const inventory = useCommerceData<components["schemas"]["StoreAttention"]>(hasLots || hasEquipment ? "/attention" : null);
  const work = useCommerceData<components["schemas"]["WorkAttention"]>(hasWork ? "/work-attention" : null);
  const deliveries = useCommerceData<components["schemas"]["DeliveryAttention"]>(hasDelivery ? "/delivery-attention" : null);
  const containers = useCommerceData<components["schemas"]["ContainerInfo"][]>(industry === "beverages" ? "/containers" : null);
  if (!operations) return null;

  const metrics: Metric[] = [];
  if (hasLots) {
    metrics.push({ label: "Fichas por reponer", count: inventory.data?.reorder, view: "catalogo", focus: "reorder" },
      { label: "Lotes por vencer en " + lotDays + " días", count: inventory.data?.expiring, view: "catalogo", focus: "expiring" });
    if (["grocery", "cosmetics", "pets"].includes(industry)) {
      metrics.push({ label: "Lotes vencidos", count: inventory.data?.expired, view: "catalogo", focus: "expired", warning: true });
    }
    if (industry === "cosmetics") metrics.push({ label: "Lotes apartados", count: inventory.data?.held, view: "catalogo", focus: "held" });
  }
  if (hasEquipment) metrics.push({ label: "Equipos en inspección", count: inventory.data?.inspections, view: "series", focus: "inspection" });
  if (hasWork) {
    metrics.push({ label: workNavigation[industry].today, count: work.data?.today, view: "trabajos", focus: "today" },
      { label: "Listos para cobrar", count: work.data?.readyToCharge, view: "trabajos", focus: "billable" });
    if (industry !== "beauty") metrics.push({ label: "Atrasados", count: work.data?.overdue, view: "trabajos", focus: "overdue", warning: true });
    if (industry === "repair") metrics.push({ label: "En espera de repuestos", count: work.data?.waitingParts, view: "trabajos", focus: "waiting-parts" });
    else metrics.push({ label: "Próximos siete días", count: work.data?.upcoming, view: "trabajos", focus: "upcoming" });
  }
  if (hasDelivery) {
    metrics.push({ label: "Retiros o entregas de hoy", count: deliveries.data?.today, view: "entregas", focus: "today" },
      { label: "Despachos atrasados", count: deliveries.data?.overdue, view: "entregas", focus: "overdue", warning: true });
  }
  if (industry === "beverages") metrics.push({ label: "Envases por recuperar",
    count: containers.data?.reduce((total, row) => total + row.borrowed, 0), view: "envases", focus: "pending" });
  const failed = [inventory, work, deliveries, containers].filter((query) => query.error);

  return <section className="industry-operations" aria-label={operations.title}>
    <header className="industry-operations-heading"><h2>{operations.title}</h2>
      <Button variant="plain" icon="help" onClick={() => open("ayuda")}>Guía del rubro</Button></header>
    <div className="industry-action-grid">
      {operations.actions.map(([view, label, detail, icon, focus]) => <button key={label} type="button"
        className="industry-action" onClick={() => open(view, focus)}>
        <span className="ui-icon-surface"><Icon name={icon} /></span>
        <span><strong>{label}</strong><small>{detail}</small></span><Icon name="arrow" />
      </button>)}
    </div>
    {metrics.length > 0 && <ul className="industry-indicators" aria-label="Pendientes del negocio">
      {metrics.map(({ label, count, view, focus, warning }) => <li key={label}>
        <button type="button" onClick={() => open(view, focus)} data-warning={warning && !!count}>
          <strong>{count ?? "—"}</strong><span>{label}</span>
        </button>
      </li>)}
    </ul>}
    {failed.length > 0 && <div className="inline-actions">
      <Alert tone="error">Algunos pendientes no se pudieron consultar.</Alert>
      <Button variant="secondary" onClick={() => failed.forEach(({ reload }) => reload())}>Reintentar pendientes</Button>
    </div>}
  </section>;
}
