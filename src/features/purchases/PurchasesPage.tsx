import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import type { BusinessRepository } from '../business/domain';
import { Feedback } from '../../shared/components/Feedback';
import { errorMessage } from '../../shared/errors';
import { useOnline } from '../../shared/hooks/useOnline';
import { formatBOB, singleLine } from '../inventory/domain';
import type { Product } from '../inventory/domain';
import type { InventoryService } from '../inventory/InventoryService';
import { usePendingOperation } from '../inventory/usePendingOperation';
import { pendingLabel } from '../inventory/pendingOperation';
import type { PurchaseService } from './PurchaseService';
import { purchaseFilter, todayInBolivia } from './domain';
import type { Purchase, PurchaseCursor, PurchaseFilter } from './domain';
import { ProductSelector } from './ProductSelector';
import { PurchaseForm } from './PurchaseForm';

type Row = { purchase: Purchase; reversed: boolean };

export function PurchasesPage({ businessRepository, inventory, service }: {
  businessRepository: BusinessRepository; inventory: InventoryService; service: PurchaseService;
}) {
  const { user } = useAuth();
  const uid = user!.uid, online = useOnline();
  const [filter, setFilter] = useState<PurchaseFilter>(() => {
    const today = todayInBolivia(); return { from: `${today.slice(0, 7)}-01`, to: today };
  });
  const [filterProduct, setFilterProduct] = useState<Product | null>(null);
  const [cursor, setCursor] = useState<PurchaseCursor>();
  const [next, setNext] = useState<PurchaseCursor | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true), [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false), [reversing, setReversing] = useState<Purchase | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const operation = usePendingOperation(uid, inventory, service, (request) => {
    setCreating(false); setReversing(null); setCursor(undefined);
    setMessage(request.kind === 'reverse' ? 'Compra anulada. Su historial se conserva.' : request.kind === 'purchase' ? 'Compra confirmada correctamente.' : 'Operación confirmada correctamente.');
    setLoading(true); setRevision((old) => old + 1);
  });
  const disabled = !online || loading || operation.busy || !!operation.pending || !!operation.recoveryError;

  useEffect(() => {
    if (creating || reversing) { editor.current?.scrollIntoView?.({ block: 'start' }); editor.current?.querySelector<HTMLElement>('h2')?.focus(); }
  }, [creating, reversing]);

  useEffect(() => {
    let current = true;
    async function load() {
      if (!await businessRepository.get(uid)) return { business: false, rows: [], next: null };
      const page = await service.list(uid, filter, cursor);
      const result = await Promise.all(page.items.map(async (purchase) => ({ purchase, reversed: await service.isReversed(uid, purchase.id) })));
      return { business: true, rows: result, next: page.next };
    }
    load().then((result) => {
      if (current) { setHasBusiness(result.business); setRows(result.rows); setNext(result.next); setError(''); setLoading(false); }
    }, (cause) => { if (current) { setError(errorMessage(cause)); setLoading(false); } });
    return () => { current = false; };
  }, [uid, businessRepository, service, filter, cursor, revision]);

  function applyFilter(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      setFilter(purchaseFilter({ from: String(data.get('from')), to: String(data.get('to')), ...(filterProduct ? { productId: filterProduct.id } : {}) }));
      setCursor(undefined); setLoading(true); setMessage(''); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa el periodo.'); }
  }

  function reverse(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reversing || disabled) return;
    try {
      const reason = singleLine(String(new FormData(event.currentTarget).get('reason')), 3, 200, 'Motivo de anulación');
      setMessage(''); setError('');
      void operation.execute({ kind: 'reverse', id: crypto.randomUUID(), purchaseId: reversing.id, reason });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa el motivo.'); }
  }

  if (hasBusiness === false) return <section className="card"><h1>Primero crea tu negocio</h1><Link to="/negocio">Crear mi negocio</Link></section>;
  return <>
    <div className="page-heading"><span className="eyebrow">COMPRAS Y COSTOS</span><h1>Compras</h1><p>Registra lo que recibes y cuánto pagas. Cada compra actualiza las existencias y su valor.</p></div>
    <Feedback error={operation.recoveryError || error || operation.error} message={message} />
    {operation.pending && <section className="feedback" aria-label="Operación pendiente"><h2>Confirma la operación pendiente</h2><p>{pendingLabel(operation.pending)}</p><p>Se consultará la misma solicitud antes de repetirla. No se reenvía automáticamente.</p><button disabled={!online || operation.busy} onClick={() => void operation.execute(operation.pending!)}>Consultar y reintentar</button></section>}
    <button className="primary" disabled={disabled || hasBusiness !== true} onClick={() => { setCreating(true); setReversing(null); setError(''); setMessage(''); }}>Nueva compra</button>
    <div ref={editor}>
      {creating && <PurchaseForm uid={uid} inventory={inventory} disabled={disabled} onSave={(input) => { if (!disabled) { setMessage(''); setError(''); void operation.execute({ kind: 'purchase', id: crypto.randomUUID(), input }); } }} onCancel={() => setCreating(false)} />}
      {reversing && <section className="card inventory-editor" aria-label="Anular compra"><h2 tabIndex={-1}>Anular compra de {reversing.productName}</h2>
        <p>Se retirarán {reversing.quantity} unidades y {formatBOB(reversing.totalMinor)} del valor del inventario. Solo es posible si no hubo movimientos posteriores sobre ese producto.</p>
        <form onSubmit={reverse}><fieldset disabled={disabled}><label htmlFor="reverseReason">Motivo de anulación</label><input id="reverseReason" name="reason" required minLength={3} maxLength={200} />
          <div className="inventory-actions"><button className="primary">Confirmar anulación</button><button type="button" onClick={() => setReversing(null)}>Cancelar anulación</button></div>
        </fieldset></form>
      </section>}
    </div>
    <section className="card inventory-editor" aria-label="Consultar compras"><h2>Consultar compras</h2>
      <form onSubmit={applyFilter}><fieldset disabled={!online || operation.busy || loading}>
        <label htmlFor="from">Desde</label><input id="from" name="from" type="date" min="2000-01-01" max="2099-12-31" defaultValue={filter.from} required />
        <label htmlFor="to">Hasta</label><input id="to" name="to" type="date" min="2000-01-01" max="2099-12-31" defaultValue={filter.to} required />
        <label htmlFor="filterProduct">Filtrar por producto</label><ProductSelector id="filterProduct" uid={uid} service={inventory} selected={filterProduct} onChange={setFilterProduct} disabled={!online || operation.busy} includeArchived />
        <button className="primary">Aplicar filtros</button>
      </fieldset></form>
    </section>
    {loading && <p role="status">Consultando compras…</p>}
    {error && <button disabled={!online || operation.busy || loading} onClick={() => { setLoading(true); setRevision((old) => old + 1); }}>Volver a consultar compras</button>}
    {!loading && !error && rows.length === 0 && <p>No hay compras en este periodo.</p>}
    {!loading && !error && <ul className="inventory-grid" aria-label="Lista de compras">{rows.map(({ purchase, reversed }) => <li className="card" key={purchase.id}>
      <h2>{purchase.productName}</h2><p>{purchase.date} · {reversed ? 'Anulada' : 'Confirmada'}</p>
      <p>{purchase.quantity} unidades × {formatBOB(purchase.unitCostMinor)} = <strong>{formatBOB(purchase.totalMinor)}</strong></p>
      <p>Referencia: {purchase.reference || 'Sin referencia'}</p>
      <p>Existencias: {purchase.stockBefore} → {purchase.stockAfter}. Valor: {formatBOB(purchase.valueBeforeMinor)} → {formatBOB(purchase.valueAfterMinor)}.</p>
      {!reversed && <button disabled={disabled} onClick={() => { setReversing(purchase); setCreating(false); setError(''); setMessage(''); }} aria-label={`Anular compra de ${purchase.productName}`}>Anular compra</button>}
    </li>)}</ul>}
    <div className="inventory-actions">
      {cursor && <button disabled={loading || operation.busy || !online} onClick={() => { setCursor(undefined); setLoading(true); }}>Primera página</button>}
      {next && <button disabled={loading || operation.busy || !online} onClick={() => { setCursor(next); setLoading(true); }}>Siguiente página</button>}
    </div>
  </>;
}
