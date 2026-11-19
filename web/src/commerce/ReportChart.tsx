import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card, DataTable, EmptyState } from "../ui/Primitives";
import { bob, dateLabel, reportResult } from "./models";
import type { Report } from "./models";

type Day = Report["days"][number];
type Group = { date: string; until: string; amount: number[] };
const metrics = [
  { label: "Ventas netas", key: "salesMinor", color: "sales" },
  { label: "Gastos operativos", key: "expensesMinor", color: "expenses" },
  { label: "Compras de mercadería", key: "purchasesMinor", color: "purchases" },
  { label: "Costo de lo vendido", key: "costMinor" },
  { label: "Pérdidas de inventario", key: "lossesMinor" },
  { label: "Resultado estimado", key: "resultMinor" },
] as const;
const shortDate = new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const compact = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });

const values = (day: Day) => metrics.map(({ key }) => key === "resultMinor" ? reportResult(day) : day[key]);

function groupDays(days: Day[], period: "day" | "week" | "month") {
  const buckets = new Map<string, Group>();
  for (const day of days) {
    const date = new Date(day.date + "T00:00:00Z");
    if (period === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = date.toISOString().slice(0, period === "month" ? 7 : 10);
    const prior = buckets.get(key);
    const amounts = values(day);
    if (prior) {
      prior.amount = prior.amount.map((amount, index) => amount + amounts[index]);
      prior.until = day.date;
    } else buckets.set(key, { date: day.date, until: day.date, amount: amounts });
  }
  return [...buckets.values()];
}

export function ReportChart({ days = [], title = "Ventas y gastos", error, loading, action }: {
  days?: Day[]; title?: string; error?: string; loading?: boolean; action?: () => void;
}) {
  const [showPurchases, setShowPurchases] = useState(false);
  const [selected, setSelected] = useState("");
  const period = days.length <= 31 ? "day" : days.length <= 180 ? "week" : "month";
  const groups = groupDays(days, period);
  const series = metrics.slice(0, showPurchases ? 3 : 2);
  const active = (group: Group) => series.some((_, index) => group.amount[index] !== 0);
  const selectedGroup = groups.find((row) => row.date === selected) ?? groups.findLast(active);
  const periodLabel = period === "day" ? "diaria" : period === "week" ? "semanal" : "mensual";
  const plotted = groups.flatMap((row) => series.map((_, index) => index === 0 ? row.amount[index] : -row.amount[index]));
  const max = Math.max(0, ...plotted);
  const min = Math.min(0, ...plotted);
  const extent = max - min || 1;
  const origin = -min / extent * 100;
  const label = (row: Group) => row.date === row.until ? dateLabel(row.date) : dateLabel(row.date) + " – " + dateLabel(row.until);
  return <Card className="report-chart">
    <div className="page-heading">
      <div className="card-title"><span className="ui-icon-surface"><Icon name="chart" /></span>
        <div><h2>{title}</h2><p>Importes en BOB · Agrupación {periodLabel}</p></div>
      </div>
      {action && <Button variant="plain" icon="arrow" onClick={action}>Ver informes</Button>}
    </div>
    {error ? <Alert tone="error">{error}</Alert> : loading ? <p role="status">Consultando movimientos…</p> : <>
      <div className="report-chart-options">
        <div className="chart-key">{series.map((item) => <span key={item.key} data-series={"color" in item ? item.color : undefined}>{item.label}</span>)}</div>
        <label><input type="checkbox" checked={showPurchases} onChange={(event) => setShowPurchases(event.target.checked)} /> Mostrar compras de mercadería</label>
      </div>
      {groups.some(active) ? <>
        <div className="report-plot">
          <div className="report-axis" aria-hidden="true">
            {max !== 0 && <span style={{ bottom: "100%" }}>{compact.format(max / 100)}</span>}
            <span style={{ bottom: origin + "%" }}>0</span>
            {min !== 0 && <span style={{ bottom: 0 }}>{compact.format(min / 100)}</span>}
          </div>
          <div className="report-bars-scroll">
            <div className="report-bars" style={{ "--baseline": origin + "%" } as React.CSSProperties}>
              {groups.map((row) => <button type="button" className="report-bar-group" key={row.date}
                aria-label={label(row)} aria-pressed={selectedGroup === row}
                onMouseEnter={() => setSelected(row.date)} onFocus={() => setSelected(row.date)} onClick={() => setSelected(row.date)}>
                <span className="report-bar-area" aria-hidden="true">
                  {series.map((item, index) => {
                    const amount = index === 0 ? row.amount[index] : -row.amount[index];
                    return <span className="report-bar-track" key={item.key}>
                      <span data-series={"color" in item ? item.color : undefined} className="report-bar"
                        style={{ height: Math.abs(amount) / extent * 100 + "%",
                          bottom: (amount >= 0 ? origin : origin + amount / extent * 100) + "%" }} />
                    </span>;
                  })}
                </span>
                <span className="report-bar-date">{shortDate.format(new Date(row.date + "T00:00:00Z"))}</span>
              </button>)}
            </div>
          </div>
        </div>
        {selectedGroup && <section className="report-selection" aria-label="Importes seleccionados">
          <h3>{label(selectedGroup)}</h3>
          <dl>{metrics.map((item, index) => <div key={item.key}><dt>{item.label}</dt><dd>{bob(selectedGroup.amount[index])}</dd></div>)}</dl>
        </section>}
      </> : <EmptyState icon="chart" title="Sin movimientos en las series seleccionadas">
        Los importes aparecen al confirmar operaciones del periodo.
      </EmptyState>}
      {days.length > 0 && <details className="chart-details">
        <summary>Ver cifras completas por día</summary>
        <DataTable caption="Cifras diarias en bolivianos" columns={["Fecha", ...metrics.map((item) => item.label)]}
          rows={days.map((day) => ({ id: day.date, cells: [dateLabel(day.date), ...values(day).map(bob)] }))} />
      </details>}
    </>}
  </Card>;
}
