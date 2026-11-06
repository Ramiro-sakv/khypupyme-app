import { specificationSummary, stockUnits } from '../../../shared/product-specification';
import { industry } from '../../../shared/business-industries';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Report } from '../../../shared/commerce';
import type { Business } from '../business/domain';
import { formatBOB } from '../inventory/domain';
import { Feedback } from '../../shared/components/Feedback';
import type { CommerceService } from './CommerceRepository';
import { commerceError } from './useCommerce';
import { PeriodPicker } from './CommerceControls';
import { currentMonth } from './presentation';
import { ReportChart } from './ReportChart';
import { downloadReport } from './export';
import { enabledTools } from '../../../shared/business-configuration';

export function DashboardPage({
  service,
  business,
  reports = false,
}: {
  service: CommerceService;
  business: Business;
  reports?: boolean;
}) {
  const [filter, setFilter] = useState(currentMonth),
    [report, setReport] = useState<Report>(),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);
  const tools = enabledTools(business);
  const showInventory =
    tools.includes('inventory') ||
    (!!report &&
      (report.inventoryValueMinor > 0 ||
        report.pendingValuationCount > 0 ||
        report.alerts.length > 0));
  useEffect(() => {
    let active = true;
    service.report(filter).then(
      (result) => {
        if (active) setReport(result);
      },
      (cause) => {
        if (active) setError(commerceError(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [service, filter, refresh]);
  function reload() {
    setError('');
    setReport(undefined);
    setRefresh(refresh + 1);
  }
  async function exportReport() {
    if (!report || exporting) return;
    setExporting(true);
    try {
      await downloadReport(report);
    } catch {
      setError('No se pudo guardar el informe. Puedes volver a intentarlo.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="page-heading heading-actions">
        <div>
          <span className="eyebrow">{reports ? 'INFORMES' : 'VISTA GENERAL'} · BETA</span>
          <h1>{reports ? 'Tus números, claros.' : `Hola, ${business.name}`}</h1>
          {!reports && industry(business.configuration?.industryId) && (
            <p className="industry-summary">
              <strong>{industry(business.configuration?.industryId)?.name}</strong> ·{' '}
              {industry(business.configuration?.industryId)?.description}{' '}
              <Link to="/negocio">Cambiar rubro y herramientas</Link>
            </p>
          )}
          <p>
            {reports
              ? 'Comprende las ventas, los costos y el dinero registrado.'
              : 'Así va tu negocio. Cada cifra viene de tus registros.'}
          </p>
        </div>
        <div className="actions">
          {!reports && (
            <Link className="button primary" to="/ventas?new=1">
              ＋ Nueva venta
            </Link>
          )}
          <button onClick={reload}>Actualizar</button>
          {report && reports && (
            <button disabled={exporting} onClick={() => void exportReport()}>
              {exporting ? 'Preparando CSV…' : 'Descargar CSV'}
            </button>
          )}
        </div>
      </div>
      <PeriodPicker
        value={filter}
        onChange={(value) => {
          setReport(undefined);
          setError('');
          setFilter(value);
        }}
      />
      <Feedback error={error} />
      {!report && !error && <p role="status">Preparando tu resumen…</p>}
      {report && (
        <>
          <div className="metric-grid">
            {[
              [
                'Ventas netas',
                formatBOB(report.salesMinor),
                `${report.saleCount} ${report.saleCount === 1 ? 'venta' : 'ventas'} del periodo`,
              ],
              ['Ganancia bruta', formatBOB(report.grossProfitMinor), 'Ventas menos costo vendido'],
              ['Gastos', formatBOB(report.expensesMinor), 'Gastos vigentes del periodo'],
              [
                'Resultado estimado',
                formatBOB(report.operatingResultMinor),
                'Ganancia bruta − gastos − bajas',
              ],
            ].map(([label, amount, detail]) => (
              <section className="metric" key={label}>
                <span>{label}</span>
                <strong>{amount}</strong>
                <small>{detail}</small>
              </section>
            ))}
          </div>
          {report.saleCount === 0 && (
            <div className="empty-notice">
              <strong>Aún no tienes ventas en este periodo.</strong> Registra tu primera venta o
              cambia las fechas para ver la evolución.
            </div>
          )}
          {showInventory && (
            <p className="inventory-summary">
              Inventario activo valorado hoy:{' '}
              <strong>{formatBOB(report.inventoryValueMinor)}</strong>
              {report.pendingValuationCount > 0 && (
                <span>
                  {' '}
                  · {report.pendingValuationCount} productos con costo pendiente, excluidos de este
                  valor.
                </span>
              )}{' '}
              ·{' '}
              <Link to={tools.includes('inventory') ? '/inventario' : '/negocio'}>
                {tools.includes('inventory')
                  ? 'Revisar productos'
                  : 'Activar inventario conservado'}
              </Link>
            </p>
          )}
          <div className="dashboard-grid">
            <section className="card">
              <ReportChart days={report.days} />
            </section>
            <section className="card accent-card">
              {(tools.includes('receivables') || report.pendingMinor > 0) && (
                <>
                  <span className="eyebrow">POR COBRAR</span>
                  <strong className="hero-number">{formatBOB(report.pendingMinor)}</strong>
                  <p>Fiados pendientes de todos los periodos. No son dinero cobrado.</p>
                  <Link
                    className="button"
                    to={tools.includes('receivables') ? '/fiados' : '/negocio'}
                  >
                    {tools.includes('receivables')
                      ? 'Revisar fiados →'
                      : 'Activar cobros conservados →'}
                  </Link>
                  <hr />
                </>
              )}
              <span>Margen bruto del periodo</span>
              <strong className="hero-number">
                {report.marginPercent === null
                  ? 'Sin ventas'
                  : `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(report.marginPercent)} %`}
              </strong>
            </section>
          </div>
          <div className={`dashboard-grid ${showInventory ? '' : 'single-column'}`}>
            <section className="card">
              <h2>Lo que más vendes</h2>
              {report.topProducts.length ? (
                <ol className="ranking-list">
                  {report.topProducts.map((item, i) => (
                    <li key={i}>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.quantity}{' '}
                          {item.specification
                            ? stockUnits(item.specification)
                            : 'unidades / servicios'}
                        </small>
                        {item.specification && (
                          <small>{specificationSummary(item.specification)}</small>
                        )}
                      </span>
                      <b>{formatBOB(item.totalMinor)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">Las ventas confirmadas aparecerán aquí.</p>
              )}
            </section>
            {showInventory && (
              <section className="card">
                <h2>Atención al inventario</h2>
                {report.alerts.length ? (
                  <ul className="ranking-list">
                    {report.alerts.map((item) => (
                      <li key={item.id}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>Mínimo: {item.minimumStock}</small>
                        </span>
                        <span className={`tag ${item.stock === 0 ? 'danger-tag' : ''}`}>
                          {item.stock === 0 ? 'Agotado' : `${item.stock} restantes`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Sin alertas de existencias en los productos activos.</p>
                )}
                <Link to={tools.includes('inventory') ? '/inventario' : '/negocio'}>
                  {tools.includes('inventory') ? 'Abrir inventario →' : 'Activar herramienta →'}
                </Link>
              </section>
            )}
          </div>
          {reports && (
            <div className="dashboard-grid">
              <section className="card">
                <h2>Movimiento de dinero registrado</h2>
                <dl className="report-totals">
                  <div>
                    <dt>Ingresos por ventas y cobros</dt>
                    <dd>{formatBOB(report.cashInMinor)}</dd>
                  </div>
                  <div>
                    <dt>Salidas por gastos y devoluciones</dt>
                    <dd>{formatBOB(report.cashOutMinor)}</dd>
                  </div>
                  <div>
                    <dt>Diferencia del periodo</dt>
                    <dd>{formatBOB(report.cashBalanceMinor)}</dd>
                  </div>
                  <div>
                    <dt>Costo de productos y servicios vendidos</dt>
                    <dd>{formatBOB(report.costMinor)}</dd>
                  </div>
                  <div>
                    <dt>Bajas manuales del inventario</dt>
                    <dd>{formatBOB(report.lossesMinor)}</dd>
                  </div>
                </dl>
                <p className="muted">
                  Incluye efectivo, QR y transferencias. Las compras de inventario no forman parte
                  de este flujo. No representa el saldo de caja o de una cuenta bancaria.
                </p>
              </section>
              <section className="card">
                <h2>Gastos por categoría</h2>
                {report.categories.length ? (
                  <ul className="ranking-list">
                    {report.categories.map((item) => (
                      <li key={item.name}>
                        <span>{item.name}</span>
                        <strong>{formatBOB(item.totalMinor)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No hay gastos registrados en el periodo.</p>
                )}
                <p className="muted">
                  Informe administrativo no fiscal. El resultado estimado no incluye impuestos,
                  depreciaciones ni costos que no hayas registrado.
                </p>
              </section>
            </div>
          )}
          {report.unvaluedLossCount > 0 && (
            <p role="alert" className="offline">
              Hay {report.unvaluedLossCount} bajas antiguas sin valoración. El resultado no incluye
              esos costos desconocidos.
            </p>
          )}
          <p className="muted report-caption">
            Generado:{' '}
            {new Date(report.generatedAt).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })} ·
            Bolivia · BOB · Las anulaciones excluyen el registro original del resultado de su
            periodo.
          </p>
        </>
      )}
    </>
  );
}
