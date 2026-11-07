import { useId } from "react";
import type { Report } from "../../../shared/commerce";
import { formatBOB } from "../inventory/domain";
import { localDate } from "../workspace/format";

export function ReportChart({ days }: Pick<Report, "days">) {
  const id = useId(),
    maximum = Math.max(
      100,
      ...days.flatMap((day) => [day.salesMinor, day.expensesMinor]),
    ),
    minimum = Math.min(
      0,
      ...days.flatMap((day) => [day.salesMinor, day.expensesMinor]),
    );
  const x = (index: number) =>
      104 + (index * 680) / Math.max(1, days.length - 1),
    y = (value: number) =>
      224 - ((value - minimum) / (maximum - minimum)) * 180;
  const points = (field: "salesMinor" | "expensesMinor") =>
    days.map((day, index) => `${x(index)},${y(day[field])}`).join(" ");
  const compact = (minor: number) =>
    new Intl.NumberFormat("es-BO", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(minor / 100);
  const labels = [
    ...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]),
  ].filter((index) => index >= 0);
  return (
    <figure className="report-chart">
      <figcaption>
        <strong>Importes en BOB · datos del periodo</strong>
        <span className="chart-legend">
          <i />
          Ventas netas
          <i className="expense-dot" />
          Gastos netos
        </span>
      </figcaption>
      <svg
        viewBox="0 0 820 280"
        role="img"
        aria-labelledby={id + "-title " + id + "-desc"}
      >
        <title id={id + "-title"}>Ventas y gastos diarios</title>
        <desc id={id + "-desc"}>
          Periodo del {days[0] ? localDate(days[0].date) : "—"} al{" "}
          {days.at(-1) ? localDate(days.at(-1)!.date) : "—"}. Los importes
          negativos representan el efecto neto de devoluciones o anulaciones.
          Las cifras completas están en la tabla.
        </desc>
        <defs>
          <linearGradient id={id + "-fill"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8e6e" stopOpacity=".15" />
            <stop offset="100%" stopColor="#2f8e6e" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const value = minimum + (maximum - minimum) * t;
          return (
            <g key={t}>
              <line
                x1="104"
                x2="784"
                y1={y(value)}
                y2={y(value)}
                stroke="#e5ece7"
                strokeDasharray="3 6"
              />
              <text
                x="88"
                y={y(value) + 5}
                textAnchor="end"
                fontSize="15"
                fill="#6c8073"
              >
                {compact(value)}
              </text>
            </g>
          );
        })}
        {days.length > 1 && (
          <polygon
            points={`${x(0)},${y(0)} ${points("salesMinor")} ${x(days.length - 1)},${y(0)}`}
            fill={"url(#" + id + "-fill)"}
          />
        )}
        <polyline
          points={points("salesMinor")}
          fill="none"
          stroke="#187051"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={points("expensesMinor")}
          fill="none"
          stroke="#ba7b34"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {days.length === 1 &&
          (["salesMinor", "expensesMinor"] as const).map((field, index) => (
            <circle
              key={field}
              cx={x(0)}
              cy={y(days[0]![field])}
              r="4"
              fill={index ? "#ba7b34" : "#187051"}
            />
          ))}
        {labels.map((index) => (
          <text
            key={index}
            x={x(index)}
            y="260"
            textAnchor={
              index === 0
                ? "start"
                : index === days.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize="15"
            fill="#6c8073"
          >
            {localDate(days[index]!.date)}
          </text>
        ))}
      </svg>
      <details>
        <summary>Ver cifras completas por día</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Ventas y gastos netos diarios en BOB
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col" className="numeric">
                  Ventas netas
                </th>
                <th scope="col" className="numeric">
                  Gastos netos
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{localDate(day.date)}</th>
                  <td className="numeric">{formatBOB(day.salesMinor)}</td>
                  <td className="numeric">{formatBOB(day.expensesMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
