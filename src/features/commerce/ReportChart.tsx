import { useEffect, useId, useRef, useState } from "react";
import type { ReportDay } from "../../../shared/commerce";
import { formatBOB } from "../inventory/domain";
import { localDate } from "../workspace/format";

const indicators = [
  ["salesMinor", "Ventas netas"],
  ["purchasesMinor", "Compras de mercadería"],
  ["costMinor", "Costo de lo vendido"],
  ["expensesMinor", "Gastos operativos"],
  ["lossesMinor", "Pérdidas de inventario"],
  ["resultMinor", "Resultado estimado"],
] as const;
type AmountKey = typeof indicators[number][0];
type Bucket = { date: string; end: string; amounts: Partial<Record<AmountKey, number>> };

function chartBuckets(days: ReportDay[], fields: AmountKey[]) {
  const mode = days.length <= 31 ? "diaria" : days.length <= 180 ? "semanal" : "mensual";
  const buckets = new Map<string, Bucket>();
  for (const day of days) {
    let key = day.date;
    if (mode === "mensual") key = day.date.slice(0, 7);
    if (mode === "semanal") {
      const monday = new Date(day.date + "T00:00:00Z");
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      key = monday.toISOString().slice(0, 10);
    }
    const bucket = buckets.get(key) ?? { date: day.date, end: day.date, amounts: {} };
    bucket.end = day.date;
    for (const field of fields) bucket.amounts[field] = (bucket.amounts[field] ?? 0) + (day[field] ?? 0);
    buckets.set(key, bucket);
  }
  return { mode, buckets: [...buckets.values()] };
}

export function ReportChart({ days, compact = false }: { days: ReportDay[]; compact?: boolean }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState("");
  const [showPurchases, setShowPurchases] = useState(false);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fields = indicators.filter(([field]) => days.some((day) => day[field] !== undefined));
  const hasPurchases = fields.some(([field]) => field === "purchasesMinor");
  const series = [
    { key: "salesMinor", label: "Ventas netas", color: "var(--primary)", sign: 1 },
    { key: "expensesMinor", label: "Gastos operativos", color: "#a85420", sign: -1 },
    ...(hasPurchases && showPurchases ? [{ key: "purchasesMinor", label: "Compras de mercadería", color: "#526881", sign: -1 } as const] : []),
  ] as const;
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const { mode, buckets } = chartBuckets(ordered, fields.map(([field]) => field));
  const plotted = (bucket: Bucket, field: typeof series[number]) => (bucket.amounts[field.key] ?? 0) * field.sign;
  const values = buckets.flatMap((bucket) => series.map((field) => plotted(bucket, field)));
  const hasBars = values.some((value) => value !== 0);
  const lastActive = buckets.reduce((last, bucket, i) => series.some((field) => plotted(bucket, field) !== 0) ? i : last, -1);
  const selectedIndex = buckets.findIndex((bucket) => bucket.date === selected);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, lastActive);
  const active = buckets[activeIndex];
  const min = Math.min(0, ...values);
  const max = Math.max(100, ...values);
  const magnitude = 10 ** Math.floor(Math.log10((max - min) / 4));
  const step = Math.max(1, Math.ceil((max - min) / 4 / magnitude) * magnitude);
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const y = (value: number) => 224 - (value - low) / (high - low) * 188;
  const axis = new Intl.NumberFormat("es-BO", { maximumFractionDigits: step < 100 ? 2 : 0 });
  const left = Math.max(64, Math.max(axis.format(low / 100).length, axis.format(high / 100).length) * 7 + 14);
  const plotWidth = width - left - 18;
  const slot = plotWidth / Math.max(1, buckets.length);
  const barWidth = Math.min(24, slot / (series.length + 1));
  const x = (index: number) => left + (index + 0.5) * slot;
  const range = (bucket: Bucket) => localDate(bucket.date) + (bucket.end !== bucket.date ? " – " + localDate(bucket.end) : "");
  function pick(index: number) {
    const target = Math.max(0, Math.min(buckets.length - 1, index));
    const bucket = buckets[target];
    if (!bucket) return;
    setSelected(bucket.date);
    svg.current?.querySelector<SVGGElement>(`[data-bucket="${target}"]`)?.focus();
  }
  const labelCount = Math.min(buckets.length, Math.max(2, Math.floor(plotWidth / 58)));
  const labels = new Set(Array.from({ length: labelCount }, (_, i) => Math.round(i * (buckets.length - 1) / Math.max(1, labelCount - 1))));

  return <figure className={`report-chart report-chart-bars${compact ? " report-chart-compact" : ""}`}>
    <figcaption>
      <strong>Importes en BOB · agrupación {mode}</strong>
      <span className="chart-legend">{series.map((field) => (
        <span key={field.key}><i style={{ background: field.color }} /> {field.label}</span>
      ))}</span>
    </figcaption>
    {hasPurchases && <label className="chart-purchases-toggle">
      <input type="checkbox" checked={showPurchases} onChange={(event) => setShowPurchases(event.target.checked)} />
      Mostrar compras de mercadería
    </label>}
    <div ref={container} className="report-chart-canvas">
      {!hasBars ? <p className="chart-empty">No hay importes para las series seleccionadas en este periodo.</p> :
        <svg ref={svg} viewBox={`0 0 ${width} 270`} role="group" aria-labelledby={id + "-title"}>
          <title id={id + "-title"}>Ventas y gastos. Selecciona una fecha para consultar sus importes.</title>
          {Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step).map((value) => (
            <g key={value}>
              <line x1={left} x2={width - 18} y1={y(value)} y2={y(value)} stroke={value === 0 ? "#82948a" : "#ddd7cc"} strokeDasharray={value ? "3 5" : undefined} />
              <text x={left - 9} y={y(value) + 4} textAnchor="end" fontSize="12" fill="#53655d">{axis.format(value / 100)}</text>
            </g>
          ))}
          {buckets.map((bucket, index) => (
            <g key={bucket.date} data-bucket={index} tabIndex={0} role="button" aria-pressed={index === activeIndex}
              aria-label={range(bucket) + ". " + series.map((field) => field.label + " " + formatBOB(bucket.amounts[field.key] ?? 0)).join(". ")}
              onFocus={() => setSelected(bucket.date)} onClick={() => setSelected(bucket.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(bucket.date);
                  return;
                }
                const next = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1
                  : event.key === "Home" ? 0 : event.key === "End" ? buckets.length - 1 : null;
                if (next !== null) { event.preventDefault(); pick(next); }
              }}>
              <rect x={x(index) - slot / 2} y="28" width={slot} height="205" fill={index === activeIndex ? "#80978b28" : "transparent"} />
              {series.map((field, i) => {
                const value = plotted(bucket, field);
                return <rect key={field.key} x={x(index) + (i - series.length / 2) * barWidth}
                  y={Math.min(y(0), y(value))} width={Math.max(0.4, barWidth - 1.5)} height={Math.abs(y(value) - y(0))}
                  rx="2" fill={field.color} />;
              })}
              {labels.has(index) && <text x={x(index)} y="252" textAnchor="middle" fontSize="12" fill="#53655d">{bucket.date.slice(8, 10)}/{bucket.date.slice(5, 7)}</text>}
            </g>
          ))}
        </svg>}
    </div>
    {hasBars && active && <div className="chart-selection" role="status" aria-live="polite">
      <strong>{range(active)}</strong>
      <dl className="chart-day-amounts">{fields.map(([field, label]) => (
        <div key={field} data-result={field === "resultMinor" || undefined}>
          <dt>{label}</dt>
          <dd data-negative={(active.amounts[field] ?? 0) < 0 || undefined}>{formatBOB(active.amounts[field] ?? 0).replace(/^-/, "−")}</dd>
        </div>
      ))}</dl>
    </div>}
    <details>
      <summary>Ver cifras completas por día</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Resultados diarios en BOB</caption>
          <thead><tr><th scope="col">Fecha</th>{fields.map(([field, label]) => <th scope="col" key={field} className="numeric">{label}</th>)}</tr></thead>
          <tbody>{ordered.map((day) => <tr key={day.date}>
            <th scope="row">{localDate(day.date)}</th>
            {fields.map(([field]) => <td className="numeric" key={field}>{day[field] === undefined ? "—" : formatBOB(day[field])}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </figure>;
}
