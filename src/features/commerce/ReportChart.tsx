import type { Report } from '../../../shared/commerce';
import { formatBOB } from '../inventory/domain';

export function ReportChart({ days }: Pick<Report, 'days'>) {
  const max = Math.max(100, ...days.flatMap((day) => [day.salesMinor, day.expensesMinor]));
  const minimum=Math.min(0,...days.flatMap(day=>[day.salesMinor,day.expensesMinor]));
  const y=(value:number)=>220-((value-minimum)/(max-minimum))*180;
  const points = (field: 'salesMinor' | 'expensesMinor') =>
    days
      .map(
        (day, index) =>
          `${50 + (index * 690) / Math.max(1, days.length - 1)},${y(day[field])}`,
      )
      .join(' ');
  return (
    <figure className="report-chart">
      <figcaption>
        <strong>El ritmo de tu negocio</strong>
        <span className="chart-legend">
          <i /> Ventas <i className="expense-dot" /> Gastos
        </span>
      </figcaption>
      <svg
        viewBox="0 0 800 265"
        role="img"
        aria-label={`Ventas y gastos diarios del ${days[0]?.date} al ${days.at(-1)?.date}. Tabla detallada a continuación.`}
      >
        {[0, 0.5, 1].map((value) => (
          <g key={value}>
            <line
              x1="50"
              x2="760"
              y1={y(minimum+(max-minimum)*value)}
              y2={y(minimum+(max-minimum)*value)}
              stroke="#dfe6df"
              strokeDasharray="4 5"
            />
            <text x="48" y={y(minimum+(max-minimum)*value)-10} fontSize="16" fill="#55685f">
              {formatBOB(minimum+(max-minimum)*value)}
            </text>
          </g>
        ))}
        <polyline
          points={points('salesMinor')}
          fill="none"
          stroke="#176d58"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <polyline
          points={points('expensesMinor')}
          fill="none"
          stroke="#bc7240"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {days.length === 1 && (
          <circle cx="50" cy={220 - (days[0]!.salesMinor / max) * 180} r="4" fill="#176d58" />
        )}
        <text x="50" y="255" fontSize="16" fill="#55685f">
          {days[0]?.date}
        </text>
        <text x="740" y="255" textAnchor="end" fontSize="16" fill="#55685f">
          {days.at(-1)?.date}
        </text>
      </svg>
      <details>
        <summary>Ver cifras por día</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ventas</th>
                <th>Gastos</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{formatBOB(day.salesMinor)}</td>
                  <td>{formatBOB(day.expensesMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
