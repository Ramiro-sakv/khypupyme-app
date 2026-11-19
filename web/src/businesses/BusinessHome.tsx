import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { Alert, Button } from "../ui/Primitives";
import { ReportChart } from "../commerce/ReportChart";
import { bob, reportResult } from "../commerce/models";
import type { Report } from "../commerce/models";
import type { BusinessProfile } from "./models";

type CashSummary = { state: "open" | "closed"; label: string; detail?: string };
const today = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/La_Paz" });
const saleLabels: Record<string, string> = {
  timber: "Vender madera", convenience: "Venta rápida con lector", grocery: "Venta rápida", beverages: "Vender cajas y unidades",
  appliances: "Vender equipos", electronics: "Vender accesorios y equipos", clothing: "Vender por modelo", footwear: "Vender por talla",
  stationery: "Vender artículos e impresión", beauty: "Atender sin cita", crafts: "Vender piezas listas",
};
const purchaseLabels: Record<string, string> = {
  appliances: "Recibir equipos por serie", electronics: "Recibir equipos por serie", hardware: "Recibir piezas y rollos",
};

export function BusinessHome({ business, industry, icon, cash, report, cashError, reportError, openCash, openSale,
  openPurchase, openInventory, openReports, industryPanel, readOnly, gettingStarted, openHelp }: {
  business: BusinessProfile; industry: string; icon: IconName;
  cash: CashSummary | null; report?: Report; cashError?: string; reportError?: string;
  openCash: () => void; openSale: () => void; openPurchase: () => void; openInventory: () => void; openReports: () => void;
  industryPanel?: ReactNode; readOnly: boolean;
  gettingStarted?: { cashStarted: boolean; catalogReady: boolean }; openHelp: () => void;
}) {
  const totals = report?.totals;
  return <div className="business-home">
    <header className="business-hero">
      <div className="hero-detail">
        <div className="hero-identity">
          <span className="hero-symbol"><Icon name={icon} /></span>
          <div>
            <p>{today.format(new Date())} · {industry}</p>
            <h1 tabIndex={-1}>{business.name}</h1>
            {business.city && <p>{business.city}</p>}
          </div>
        </div>
        <div className="hero-actions">
          {!readOnly && <Button icon="cart" onClick={openSale}>{saleLabels[business.industry] ?? "Vender"}</Button>}
          {business.industry === "timber" && <Button variant="secondary" icon="wood" onClick={openInventory}>Consultar medidas</Button>}
          {!readOnly && <Button variant="secondary" icon="parcel" onClick={openPurchase}>
            {purchaseLabels[business.industry] ?? "Registrar compra"}
          </Button>}
        </div>
      </div>
      <section className="hero-cash" aria-label="Caja">
        <strong className="status-chip" data-state={cash?.state ?? "unknown"}>{cash?.label ?? "Caja"}</strong>
        {cashError ? <Alert tone="error">{cashError}</Alert> : <p>
          {cash?.detail ?? (cash ? "Prepara tu fondo si usarás efectivo." : "Consultando la caja…")}
        </p>}
        <Button variant="secondary" icon="cash" onClick={openCash} disabled={!cash && !readOnly}>
          {cash?.state === "closed" && !readOnly ? "Abrir caja" : "Ver caja"}
        </Button>
      </section>
    </header>
    {totals && <dl className="home-totals">
      {([["Ventas netas", totals.salesMinor], ["Compras", totals.purchasesMinor], ["Gastos netos", totals.expensesMinor],
        ["Resultado estimado", reportResult(totals)]] as const).map(([label, amount]) =>
        <div key={label}><dt>{label}</dt><dd>{bob(amount)}</dd></div>)}
    </dl>}
    {industryPanel}
    {gettingStarted && <aside className="workspace-industry-banner">
      <Icon name="help" /><div><strong>Primeros pasos</strong><p>{gettingStarted.catalogReady
        ? "El catálogo está listo para tu primera venta."
        : gettingStarted.cashStarted ? "Añade tus productos o servicios al inventario."
          : "Prepara la caja si usarás efectivo y añade productos o servicios."}</p></div>
      <Button variant="plain" onClick={openHelp}>Abrir ayuda</Button>
    </aside>}
    <ReportChart days={report?.days} title="Últimos siete días" loading={!report && !reportError} error={reportError} action={openReports} />
  </div>;
}
