import type { SalePreviewLine } from './presentation';
import { specificationSummary, stockUnits } from '../../../shared/product-specification';
import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Command, FinancialRecord, PaymentMethod, Resource } from '../../../shared/commerce';
import type { Business } from '../business/domain';
import type { InventoryService } from '../inventory/InventoryService';
import { formatBOB } from '../inventory/domain';
import { useOnline } from '../../shared/hooks/useOnline';
import { Feedback } from '../../shared/components/Feedback';
import type { CommerceService } from './CommerceRepository';
import { commerceError, useCommerceCommand, useRecords } from './useCommerce';
import { DateInput, MethodSelect, OperationFeedback, PeriodPicker } from './CommerceControls';
import { currentMonth, paymentNames } from './presentation';
import { enabledTools } from '../../../shared/business-configuration';
import { useBusiness } from '../business/business-context';
import { CommandReview } from './CommandReview';

const SaleForm = lazy(() => import('./SaleForm').then((module) => ({ default: module.SaleForm })));
const RecordForm = lazy(() =>
  import('./RecordForm').then((module) => ({ default: module.RecordForm })),
);

const labels: Record<Resource, { title: string; singular: string; hint: string }> = {
  sales: {
    title: 'Ventas',
    singular: 'venta',
    hint: 'Vende productos y servicios, al contado o fiado.',
  },
  expenses: {
    title: 'Gastos',
    singular: 'gasto',
    hint: 'Registra los gastos de operación de tu negocio.',
  },
  receivables: {
    title: 'Fiados y cobros',
    singular: 'fiado anterior',
    hint: 'Consulta lo pendiente y registra cobros completos.',
  },
  customers: {
    title: 'Clientes',
    singular: 'cliente',
    hint: 'Tu agenda de clientes, compartida entre ventas y fiados.',
  },
  services: {
    title: 'Servicios',
    singular: 'servicio',
    hint: 'Define precios y costos directos de los servicios que ofreces.',
  },
};
export function RecordsPage({
  uid,
  business,
  service,
  inventory,
  resource,
}: {
  uid: string;
  business: Business;
  service: CommerceService;
  inventory: InventoryService;
  resource: Resource;
}) {
  const [params] = useSearchParams(),
    [open, setOpen] = useState(params.has('new'));
  const [filter, setFilter] = useState(currentMonth),
    [review, setReview] = useState<Command | null>(null),
    [editing, setEditing] = useState<FinancialRecord | null>(null),
    [action, setAction] = useState<{ record: FinancialRecord; kind: 'collect' | 'cancel' } | null>(
      null,
    );
  const [salePreview, setSalePreview] = useState<SalePreviewLine[]>([]);
  const [message, setMessage] = useState(''),
    [receipt, setReceipt] = useState<FinancialRecord | null>(null),
    [error, setError] = useState('');
  const [view, setView] = useState('all'),
    [search, setSearch] = useState('');
  const online = useOnline(),
    catalog = resource === 'customers' || resource === 'services';
  const records = useRecords(service, resource, catalog ? undefined : filter);
  const { refresh: refreshBusiness } = useBusiness();
  const operation = useCommerceCommand(uid, service, (id, confirmed) => {
    if (confirmed.kind === 'configure-business' || confirmed.kind === 'business-settings')
      refreshBusiness();
    setReview(null);
    setOpen(false);
    setEditing(null);
    setAction(null);
    records.firstPage();
    setMessage('Operación confirmada. Tus registros están actualizados.');
    if (resource === 'sales')
      service.get('sales', id).then(setReceipt, (cause) => setError(commerceError(cause)));
  });
  const blocked = operation.blocked || !online;
  const visible = records.items.filter(
    (record) =>
      (!search ||
        `${record.name ?? ''} ${record.customerName ?? ''} ${record.description ?? ''}`
          .toLocaleLowerCase('es')
          .includes(search.toLocaleLowerCase('es'))) &&
      (view === 'all' || (catalog ? String(record.active) === view : record.status === view)),
  );
  function archive(record: FinancialRecord) {
    setReview(
      resource === 'customers'
        ? {
            kind: 'customer',
            operationId: crypto.randomUUID(),
            input: {
              id: record.id,
              name: record.name!,
              phone: record.phone ?? '',
              notes: record.notes ?? '',
              active: !record.active,
            },
          }
        : {
            kind: 'service',
            operationId: crypto.randomUUID(),
            input: {
              id: record.id,
              name: record.name!,
              priceMinor: record.priceMinor!,
              unitCostMinor: record.unitCostMinor!,
              active: !record.active,
            },
          },
    );
  }
  return (
    <>
      <div className="page-heading heading-actions">
        <div>
          <span className="eyebrow">TU NEGOCIO · {business.name}</span>
          <h1>{labels[resource].title}</h1>
          <p>{labels[resource].hint}</p>
        </div>
        <button
          className="primary"
          aria-label={
            resource === 'sales' ? 'Nueva venta' : `Registrar ${labels[resource].singular}`
          }
          disabled={blocked || !!review}
          onClick={() => {
            setEditing(null);
            setAction(null);
            setOpen(true);
            setReceipt(null);
            setMessage('');
          }}
        >
          ＋ {resource === 'sales' ? 'Nueva venta' : `Registrar ${labels[resource].singular}`}
        </button>
      </div>
      <OperationFeedback operation={operation} message={message} />
      <Feedback error={error} />
      {review && (
        <CommandReview
          salePreview={salePreview}
          command={review}
          record={action?.record ?? null}
          onConfirm={() => void operation.execute(review)}
          onBack={() => setReview(null)}
          busy={blocked}
        />
      )}
      {open && (
        <section className="card record-editor" hidden={!!review}>
          <div className="heading-actions">
            <h2>{editing ? 'Editar registro' : `Registrar ${labels[resource].singular}`}</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cerrar formulario
            </button>
          </div>
          {resource === 'sales' ? (
            <Suspense fallback={<p role="status">Abriendo formulario…</p>}>
              <SaleForm
                uid={uid}
                inventory={inventory}
                commerce={service}
                disabled={blocked}
                onReview={(command, preview) => {
                  setSalePreview(preview);
                  setReview(command);
                }}
                tools={enabledTools(business)}
                activity={
                  business.configuration?.profileId === 'services'
                    ? 'services'
                    : (business.activity ?? 'commerce')
                }
              />
            </Suspense>
          ) : (
            <Suspense fallback={<p role="status">Abriendo formulario…</p>}>
              <RecordForm
                key={editing?.id ?? 'new'}
                allowCustomers={enabledTools(business).includes('customers')}
                resource={resource}
                record={editing}
                service={service}
                onReview={setReview}
                disabled={blocked}
              />
            </Suspense>
          )}
        </section>
      )}
      {action && (
        <section className="card record-editor" hidden={!!review}>
          <h2>{action.kind === 'collect' ? 'Cobrar fiado completo' : 'Anular registro'}</h2>
          <p>
            <strong>
              {action.record.customerName || action.record.description || 'Registro seleccionado'}
            </strong>{' '}
            · {formatBOB(action.record.totalMinor ?? action.record.amountMinor ?? 0)}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget),
                operationId = crypto.randomUUID();
              if (action.kind === 'collect')
                setReview({
                  operationId,
                  kind: 'collect',
                  input: {
                    id: action.record.id,
                    date: String(data.get('date')),
                    method: String(data.get('method')) as PaymentMethod,
                  },
                });
              else
                setReview({
                  operationId,
                  kind:
                    resource === 'sales'
                      ? 'cancel-sale'
                      : resource === 'expenses'
                        ? 'cancel-expense'
                        : 'cancel-receivable',
                  input: { id: action.record.id, reason: String(data.get('reason')) },
                });
            }}
          >
            <fieldset disabled={blocked}>
              {action.kind === 'collect' ? (
                <>
                  <DateInput />
                  <MethodSelect />
                </>
              ) : (
                <>
                  <label htmlFor="reason">Motivo de anulación</label>
                  <input id="reason" name="reason" required minLength={3} maxLength={200} />
                </>
              )}
              <div className="actions">
                <button className="primary">Revisar operación</button>
                <button type="button" onClick={() => setAction(null)}>
                  Cerrar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {receipt && resource === 'sales' && (
        <section className="card receipt" aria-label="Detalle de venta">
          <div className="heading-actions">
            <h2>Detalle de venta</h2>
            <button onClick={() => setReceipt(null)}>Cerrar detalle</button>
          </div>
          <p>
            <strong>{business.name}</strong> · {receipt.date} ·{' '}
            {receipt.status === 'cancelled' ? 'Anulada' : 'Confirmada'}
          </p>
          <p>
            Cliente: {receipt.customerName || 'Venta sin nombre'} ·{' '}
            {paymentNames[receipt.payment as keyof typeof paymentNames]}
          </p>
          <ul className="sale-lines">
            {receipt.lines?.map((line, index) => (
              <li key={index}>
                <span>
                  {line.name}
                  {line.specification && <small>{specificationSummary(line.specification)}</small>}
                  <small>
                    {line.quantity} {line.specification ? stockUnits(line.specification) : ''} ×{' '}
                    {formatBOB(line.priceMinor)} · Descuento {formatBOB(line.discountMinor)}
                  </small>
                </span>
                <b>{formatBOB(line.totalMinor)}</b>
              </li>
            ))}
          </ul>
          <p className="sale-total">
            Total <strong>{formatBOB(receipt.totalMinor!)}</strong>
          </p>
          <p>Nota interna: {receipt.description || 'Sin nota'}</p>
          <p className="muted">Comprobante administrativo no fiscal · Ref. {receipt.id}</p>
          <button onClick={() => window.print()}>Imprimir comprobante</button>
        </section>
      )}
      <section className="card">
        <div className="heading-actions">
          <h2>{catalog ? 'Directorio' : 'Historial'}</h2>
          <button disabled={records.loading} onClick={records.refresh}>
            Actualizar lista
          </button>
        </div>
        {!catalog && (
          <PeriodPicker
            value={filter}
            onChange={(value) => {
              setFilter(value);
              records.firstPage();
            }}
          />
        )}
        <div className="form-columns">
          <div>
            <label htmlFor="recordSearch">Buscar en esta página</label>
            <input
              id="recordSearch"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre o descripción"
            />
          </div>
          <div>
            <label htmlFor="recordStatus">Estado en esta página</label>
            <select
              id="recordStatus"
              value={view}
              onChange={(event) => setView(event.target.value)}
            >
              <option value="all">Todos</option>
              {catalog ? (
                <>
                  <option value="true">Activos</option>
                  <option value="false">Archivados</option>
                </>
              ) : resource === 'receivables' ? (
                <>
                  <option value="pending">Pendientes</option>
                  <option value="paid">Cobrados</option>
                  <option value="cancelled">Anulados</option>
                </>
              ) : (
                <>
                  <option value="active">Vigentes</option>
                  <option value="cancelled">Anulados</option>
                </>
              )}
            </select>
          </div>
        </div>
        <Feedback error={records.error} />
        {records.loading ? (
          <p role="status">Consultando registros…</p>
        ) : (
          <>
            {!visible.length && (
              <p className="empty-notice">
                No hay registros que coincidan en esta página. Puedes registrar uno o cambiar el
                periodo y los filtros.
              </p>
            )}
            <ul className="records-list">
              {visible.map((record) => (
                <li key={record.id}>
                  <div>
                    <span className="tag">
                      {catalog
                        ? record.active
                          ? 'Activo'
                          : 'Archivado'
                        : record.status === 'pending'
                          ? 'Pendiente'
                          : record.status === 'paid'
                            ? 'Cobrado'
                            : record.status === 'cancelled'
                              ? 'Anulado'
                              : 'Confirmado'}
                    </span>
                    <h3>
                      {record.name ||
                        record.customerName ||
                        record.description ||
                        'Venta sin nombre'}
                    </h3>
                    <p className="muted">
                      {record.date}
                      {record.category ? ` · ${record.category}` : ''}
                      {resource === 'receivables'
                        ? record.origin === 'sale'
                          ? ' · Venta fiada'
                          : ' · Deuda anterior'
                        : ''}
                      {record.phone ? ` · ${record.phone}` : ''}
                    </p>
                    {record.description && <p>{record.description}</p>}
                    {record.reason && <p>Motivo: {record.reason}</p>}
                    {record.notes && <p>{record.notes}</p>}
                  </div>
                  <div className="record-amount">
                    {resource !== 'customers' && (
                      <strong>
                        {formatBOB(
                          record.totalMinor ?? record.amountMinor ?? record.priceMinor ?? 0,
                        )}
                      </strong>
                    )}
                    {resource === 'services' && (
                      <small>Costo directo: {formatBOB(record.unitCostMinor!)}</small>
                    )}
                    <div className="actions">
                      {catalog && (
                        <>
                          <button
                            disabled={blocked || !!review}
                            onClick={() => {
                              setEditing(record);
                              setOpen(true);
                            }}
                          >
                            Editar
                          </button>
                          <button disabled={blocked || !!review} onClick={() => archive(record)}>
                            {record.active ? 'Archivar' : 'Reactivar'}
                          </button>
                        </>
                      )}
                      {resource === 'sales' && (
                        <button onClick={() => setReceipt(record)}>Ver detalle</button>
                      )}
                      {resource === 'receivables' && record.status === 'pending' && (
                        <button
                          className="primary"
                          disabled={blocked || !!review}
                          onClick={() => {
                            setOpen(false);
                            setReceipt(null);
                            setAction({ record, kind: 'collect' });
                          }}
                        >
                          Cobrar completo
                        </button>
                      )}
                      {!catalog &&
                        record.status !== 'cancelled' &&
                        (resource !== 'receivables' || record.origin === 'manual') && (
                          <button
                            disabled={blocked || !!review}
                            onClick={() => {
                              setOpen(false);
                              setReceipt(null);
                              setAction({ record, kind: 'cancel' });
                            }}
                          >
                            Anular
                          </button>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="pagination">
          <span>Hasta 25 registros por página</span>
          {records.hasPrevious && (
            <button onClick={records.firstPage} disabled={records.loading}>
              Primera página
            </button>
          )}
          {records.next && (
            <button onClick={records.nextPage} disabled={records.loading}>
              Siguiente página
            </button>
          )}
        </div>
      </section>
    </>
  );
}
