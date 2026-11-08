import { useEffect, useId, useRef, useState } from "react";
import type { Report } from "../../../shared/commerce";
import { formatBOB } from "../inventory/domain";
import { localDate } from "../workspace/format";

type Day = Report["days"][number];
interface Bucket extends Day { end: string }
function chartBuckets(days: Day[]) {
  const mode = days.length <= 31 ? "Diaria" : days.length <= 180 ? "Semanal" : "Mensual";
  const buckets = new Map<string, Bucket>();
  for (const day of days) {
    let key = day.date;
    if (mode === "Mensual") key = day.date.slice(0, 7);
    if (mode === "Semanal") {
      const monday = new Date(day.date + "T00:00:00Z");
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      key = monday.toISOString().slice(0, 10);
    }
    const previous = buckets.get(key);
    buckets.set(key, { date: previous?.date ?? day.date, end: day.date, salesMinor: (previous?.salesMinor ?? 0) + day.salesMinor, expensesMinor: (previous?.expensesMinor ?? 0) + day.expensesMinor });
  }
  return { mode, buckets: [...buckets.values()] };
}
export function ReportChart({ days }: Pick<Report, "days">) {
  const id = useId(), container = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800), [selected, setSelected] = useState("");
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.max(320, Math.round(entry.contentRect.width))); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const { mode, buckets } = chartBuckets(ordered);
  const nonzero = ordered.filter((day) => day.salesMinor !== 0 || day.expensesMinor !== 0).length;
  const lastActive = buckets.reduce((last, day, index) => day.salesMinor !== 0 || day.expensesMinor !== 0 ? index : last, -1);
  const selectedIndex = buckets.findIndex((day) => day.date === selected);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, lastActive), active = buckets[activeIndex];
  const minimum = Math.min(0, ...buckets.flatMap((day) => [day.salesMinor, day.expensesMinor]));
  const maximum = Math.max(100, ...buckets.flatMap((day) => [day.salesMinor, day.expensesMinor]));
  const magnitude = 10 ** Math.floor(Math.log10((maximum - minimum) / 4));
  const step = Math.ceil((maximum - minimum) / 4 / magnitude) * magnitude;
  const low = Math.floor(minimum / step) * step, high = Math.ceil(maximum / step) * step;
  const y = (value: number) => 224 - (value - low) / (high - low) * 188;
  const axisFormat = new Intl.NumberFormat("es-BO", { minimumFractionDigits: step < 100 ? 2 : 0, maximumFractionDigits: step < 100 ? 2 : 0 });
  const left = Math.max(72, Math.max(axisFormat.format(low / 100).length, axisFormat.format(high / 100).length) * 7 + 16);
  const plotWidth = width - left - 18, slot = plotWidth / Math.max(1, buckets.length), barWidth = Math.max(2, Math.min(22, slot * 0.3));
  const x = (index: number) => left + (index + 0.5) * slot;
  const rangeLabel = (bucket: Bucket) => localDate(bucket.date) + (bucket.end !== bucket.date ? " – " + localDate(bucket.end) : "");
  const pick = (index: number) => {
    const target = Math.max(0, Math.min(buckets.length - 1, index));
    if (buckets[target]) { setSelected(buckets[target]!.date); svg.current?.querySelector<SVGGElement>(`[data-bucket="${target}"]`)?.focus(); }
  };
  const labelCount = Math.min(buckets.length, Math.max(2, Math.floor(plotWidth / 130)));
  const labelIndices = new Set(Array.from({ length: labelCount }, (_, i) => Math.round(i * (buckets.length - 1) / Math.max(1, labelCount - 1))));
  return <figure className="report-chart report-chart-bars">
    <figcaption>
      <strong>Importes en BOB · agrupación {mode.toLowerCase()}</strong>
      <span className="chart-legend">
        <i />Ventas netas<i className="expense-dot" />Gastos netos</span>
    </figcaption>
    <div ref={container} className="report-chart-canvas">
      {!nonzero ? <div className="chart-empty">
        <strong>No hay importes netos que representar.</strong>
        <p>Consulta otro periodo. Las cifras diarias siguen disponibles en la tabla.</p>
      </div> : <>
        <p className="muted">{nonzero} de {ordered.length} días con importes netos distintos de cero. Los valores negativos reflejan devoluciones o anulaciones.</p>
        <svg ref={svg} viewBox={`0 0 ${width} 278`} role="group" aria-labelledby={id + "-title"}>
          <title id={id + "-title"}>Ventas y gastos, agrupación {mode.toLowerCase()}. Selecciona una barra para consultar sus importes.</title>
          {Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step).map((value) => <g key={value}>
        <line x1={left} x2={width - 18} y1={y(value)} y2={y(value)} stroke={value === 0 ? "#82948a" : "#e4ded1"} strokeDasharray={value === 0 ? undefined : "3 5"} />
        <text x={left - 10} y={y(value) + 4} textAnchor="end" fontSize="12" fill="#53655d">{axisFormat.format(value / 100)}</text>
          </g>)}
          {buckets.map((bucket, index) => <g key={bucket.date} data-bucket={index} tabIndex={0} role="button" aria-pressed={index === activeIndex} aria-label={`${rangeLabel(bucket)}. Ventas ${formatBOB(bucket.salesMinor)}. Gastos ${formatBOB(bucket.expensesMinor)}.`} onFocus={() => setSelected(bucket.date)} onPointerEnter={() => setSelected(bucket.date)} onClick={() => setSelected(bucket.date)} onKeyDown={(event) => {
            const target = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? buckets.length - 1 : null;
            if (target !== null) { event.preventDefault(); pick(target); }
          }}>
            <rect x={x(index) - slot / 2} y="28" width={slot} height="205" fill={index === activeIndex ? "#e5eee660" : "transparent"} />
            {(["salesMinor", "expensesMinor"] as const).map((field, series) => <rect key={field} x={x(index) + (series ? 2 : -barWidth - 2)} y={Math.min(y(0), y(bucket[field]))} width={barWidth} height={Math.abs(y(bucket[field]) - y(0))} rx="2" fill={series ? "#b77d35" : "#11654d"} />)}
            {labelIndices.has(index) && <text x={x(index)} y="254" textAnchor={buckets.length === 1 ? "middle" : index === 0 ? "start" : index === buckets.length - 1 ? "end" : "middle"} fontSize="12" fill="#53655d">{bucket.date.slice(8, 10)}/{bucket.date.slice(5, 7)}</text>}
          </g>)}
        </svg>
        {active && <div className="chart-selection" role="status" aria-live="polite">
          <strong>{rangeLabel(active)}</strong>
          <span>Ventas: {formatBOB(active.salesMinor)}</span>
          <span>Gastos: {formatBOB(active.expensesMinor)}</span>
        </div>}
        <div className="actions">
          <button type="button" disabled={activeIndex === 0} onClick={() => pick(activeIndex - 1)}>Periodo anterior</button>
          <button type="button" disabled={activeIndex === buckets.length - 1} onClick={() => pick(activeIndex + 1)}>Periodo siguiente</button>
        </div>
      </>}
    </div>
    <details>
      <summary>Ver cifras completas por día</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Ventas y gastos netos diarios en BOB</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col" className="numeric">Ventas netas</th>
              <th scope="col" className="numeric">Gastos netos</th>
            </tr>
          </thead>
          <tbody>{ordered.map((day) => <tr key={day.date}>
            <th scope="row">{localDate(day.date)}</th>
            <td className="numeric">{formatBOB(day.salesMinor)}</td>
            <td className="numeric">{formatBOB(day.expensesMinor)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </figure>;
}
