import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { Alert, Button, Card, DataTable, EmptyState } from "../ui/Primitives";
import type { BusinessProfile } from "./models";
import type { ReactNode } from "react";

type Day = { date: string; salesMinor: number; expensesMinor: number };
type CashSummary = { state: "open" | "closed"; label: string; detail?: string };

const bolivianos = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
const shortDay = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", timeZone: "UTC" });

export function SalesChart({ days, subtitle = "Movimientos confirmados por día", error, action }:
  { days: readonly Day[]; subtitle?: string; error?: string; action?: () => void }) {
  const hasActivity = days.some(({ salesMinor, expensesMinor }) => salesMinor !== 0 || expensesMinor !== 0);
  return <Card className="sales-card">
    <div className="page-heading">
      <div className="card-title"><span className="ui-icon-surface"><Icon name="chart" /></span>
        <div><h2>Ventas y gastos</h2><p>{subtitle}</p></div>
      </div>
      {action && <Button variant="plain" onClick={action}>Ver informes</Button>}
    </div>
    {error ? <Alert tone="error">{error}</Alert> : hasActivity ? <ConfirmedChart days={days} /> : <div className="chart-empty">
      <EmptyState icon="chart" title="Sin datos para graficar">Los importes aparecerán aquí al confirmar movimientos del negocio.</EmptyState>
    </div>}
  </Card>;
}

function ConfirmedChart({ days }: { days: readonly Day[] }) {
  const maximum = Math.max(...days.flatMap(({ salesMinor, expensesMinor }) => [Math.abs(salesMinor), Math.abs(expensesMinor)]));
  function bar(value: number, kind: "sales" | "expenses") {
    const height = Math.abs(value) / maximum * 50 + "%";
    return <span className={"chart-column__bar chart-column__bar--" + kind}
      style={{ height, bottom: value >= 0 ? "50%" : undefined, top: value < 0 ? "50%" : undefined }} />;
  }
  function label(date: string) {
    return shortDay.format(new Date(date + "T00:00:00Z"));
  }
  return <>
    <div className="chart-legend"><span>Ventas netas</span><span>Gastos operativos</span></div>
    <div className="chart-scroll">
      <div className="mini-chart" aria-hidden="true">
        {days.map((day) => <div className="chart-day" key={day.date}>
          <div className="chart-pair">
            <div className="chart-column">{bar(day.salesMinor, "sales")}</div>
            <div className="chart-column">{bar(-day.expensesMinor, "expenses")}</div>
          </div>
          <span>{label(day.date)}</span>
        </div>)}
      </div>
    </div>
    <details className="chart-details">
      <summary>Ver cifras por día</summary>
      <DataTable caption="Ventas y gastos diarios en bolivianos" columns={["Fecha", "Ventas netas", "Gastos operativos"]}
        rows={days.map((day) => ({ id: day.date, cells: [label(day.date), bolivianos.format(day.salesMinor / 100),
          bolivianos.format(day.expensesMinor / 100)] }))} />
    </details>
  </>;
}

export function BusinessHome({ business, industry, icon, cash, days, cashError, reportError, openCash, openSale, openPurchase, openReports, industryPanel, readOnly }: {
  business: BusinessProfile;
  industry: string;
  icon: IconName;
  cash: CashSummary | null;
  days: readonly Day[];
  cashError?: string;
  reportError?: string;
  openCash: () => void;
  openSale: () => void;
  openPurchase: () => void;
  openReports: () => void;
  industryPanel?: ReactNode;
  readOnly: boolean;
}) {
  return <>
    <div className="business-hero">
      <div className="hero-detail">
        <span className="hero-industry"><Icon name={icon} />{industry}</span>
        <h1 tabIndex={-1}>{business.name}</h1>
        {business.city && <p>{business.city}</p>}
      </div>
      <span className="hero-symbol"><Icon name={icon} /></span>
    </div>
    <div className="workspace-grid">
      <aside className="home-sidebar" aria-label="Caja y acciones principales">
        <Card className="cash-card">
          <div className="card-title"><span className="ui-icon-surface"><Icon name="cash" /></span>
            <div><h2>Caja</h2><p>Estado del negocio</p></div>
          </div>
          <strong className="status-chip" data-state={cash?.state ?? "unknown"}>
            {cash?.label ?? "Sin datos de caja"}
          </strong>
          {cashError ? <Alert tone="error">{cashError}</Alert> : cash?.detail && <p className="cash-caption">{cash.detail}</p>}
        </Card>
        <Card className="home-actions">
          <h2>Acciones principales</h2>
          <Button variant={cash?.state === "open" ? "secondary" : "primary"} icon="cash" onClick={openCash}>
            {cash?.state === "open" || readOnly ? "Ver caja" : "Abrir caja"}
          </Button>
          {!readOnly && <><Button variant="secondary" icon="shops" onClick={openSale}>{business.industry === "convenience" ? "Venta rápida con lector" :
            business.industry === "appliances" ? "Vender equipos" : business.industry === "electronics" ? "Vender accesorios y equipos" :
            business.industry === "footwear" ? "Vender por talla" : business.industry === "stationery" ? "Vender artículos e impresión" :
            business.industry === "beauty" ? "Atender sin cita" : business.industry === "crafts" ? "Vender piezas listas" : "Vender"}</Button>
          <Button variant="secondary" icon="parcel" onClick={openPurchase}>{business.industry === "appliances" || business.industry === "electronics" ?
            "Recibir equipos por serie" : business.industry === "hardware" ? "Recibir piezas y rollos" : "Registrar compra"}</Button></>}
        </Card>
        {industryPanel}
      </aside>
      <SalesChart days={days} error={reportError} action={openReports} />
    </div>
  </>;
}
