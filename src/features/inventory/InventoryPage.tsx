import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import type { BusinessRepository } from '../business/domain';
import { Feedback } from '../../shared/components/Feedback';
import { errorMessage } from '../../shared/errors';
import { useOnline } from '../../shared/hooks/useOnline';
import { formatBOB, InventoryInputError, stockStatus } from './domain';
import type { PageCursor, Product, CreateProduct } from './domain';
import type { InventoryService } from './InventoryService';
import { pendingLabel } from './pendingOperation';
import { usePendingOperation } from './usePendingOperation';
import type { PurchaseService } from '../purchases/PurchaseService';
import { ValuationForm } from './ValuationForm';
import type { PendingOperation } from './pendingOperation';
import { ProductForm } from './ProductForm';
import { MovementForm } from './MovementForm';
import { InventoryHistory } from './InventoryHistory';

type Selection = { kind: 'new' } | { kind: 'edit' | 'move' | 'history' | 'valuation'; product: Product } | null;

export function InventoryPage({ businessRepository, service, purchases }: { businessRepository: BusinessRepository; service: InventoryService; purchases: PurchaseService }) {
  const { user } = useAuth();
  // La ruta está protegida y se monta con key=uid para separar estados entre cuentas.
  const uid = user!.uid;
  const online = useOnline();
  const [active, setActive] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<PageCursor>();
  const [next, setNext] = useState<PageCursor | null>(null);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const editor = useRef<HTMLDivElement>(null);
  const operation = usePendingOperation(uid, service, purchases, (request) => saved(request.kind === 'create' ? 'Producto creado correctamente.' : request.kind === 'valuation' ? 'Costo inicial confirmado correctamente.' : 'Movimiento confirmado correctamente.'));
  const { pending } = operation;
  const busy = editing || operation.busy;
  const disabled = busy || !online || loading || !!pending || !!operation.recoveryError;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (selection) {
      editor.current?.scrollIntoView?.({ block: 'start' });
      editor.current?.querySelector<HTMLElement>('h2')?.focus();
    }
  }, [selection]);

  useEffect(() => {
    let current = true;
    async function load() {
      const business = await businessRepository.get(uid);
      if (!business) return { business: false, items: [], next: null };
      return { business: true, ...await service.list(uid, active, cursor) };
    }
    load().then((result) => {
      if (current) {
        setHasBusiness(result.business); setProducts(result.items); setNext(result.next); setLoadError(''); setLoading(false);
      }
    }, (cause) => { if (current) { setLoadError(errorMessage(cause)); setLoading(false); } });
    return () => { current = false; };
  }, [uid, businessRepository, service, active, cursor, revision]);

  function refresh() { setLoading(true); setRevision((value) => value + 1); }
  function saved(text: string) {
    setSelection(null); setCursor(undefined); setMessage(text); refresh();
  }

  function execute(request: PendingOperation) {
    setError(''); setMessage('');
    return operation.execute(request);
  }

  async function editOrArchive(action: () => Promise<void>, text: string) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); if (alive.current) saved(text); }
    catch (cause) { if (alive.current) setError(cause instanceof InventoryInputError ? cause.message : errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  function saveProduct(input: CreateProduct) {
    if (disabled) return;
    if (selection?.kind === 'edit') void editOrArchive(() => service.update(uid, selection.product.id, input), 'Producto actualizado correctamente.');
    else void execute({ kind: 'create', id: crypto.randomUUID(), input });
  }

  function changeView(value: boolean) {
    setActive(value); setCursor(undefined); setSelection(null); setLoading(true); setError(''); setMessage('');
  }

  if (hasBusiness === false) return <section className="card"><h1>Primero crea tu negocio</h1><p>El inventario pertenecerá únicamente a tu cuenta.</p><Link to="/negocio">Crear mi negocio</Link></section>;
  return <>
    <div className="page-heading"><span className="eyebrow">PRODUCTOS Y EXISTENCIAS</span><h1>Inventario</h1><p>Productos, entradas y salidas con un historial que se conserva.</p></div>
    <Feedback error={operation.recoveryError || error || operation.error} message={message} />
    {pending && <section className="feedback" aria-label="Operación pendiente">
      <h2>Confirma la operación pendiente</h2>
      <p>{pendingLabel(pending)}</p>
      <p>Se conserva la misma solicitud para comprobar su resultado sin duplicar existencias. No se enviará automáticamente.</p>
      <button disabled={busy || !online} onClick={() => void execute(pending)}>Consultar y reintentar</button>
    </section>}
    <div className="inventory-toolbar">
      <div className="inventory-actions" role="group" aria-label="Estado de productos">
        <button aria-pressed={active} disabled={busy || active} onClick={() => changeView(true)}>Activos</button>
        <button aria-pressed={!active} disabled={busy || !active} onClick={() => changeView(false)}>Archivados</button>
      </div>
      <button className="primary" disabled={disabled || hasBusiness !== true} onClick={() => { setSelection({ kind: 'new' }); setError(''); setMessage(''); }}>Nuevo producto</button>
    </div>
    <div ref={editor}>
    {selection?.kind === 'new' || selection?.kind === 'edit' ? <ProductForm key={selection.kind === 'edit' ? selection.product.id : 'new'} product={selection.kind === 'edit' ? selection.product : null} disabled={disabled} onSave={saveProduct} onCancel={() => setSelection(null)} /> : null}
    {selection?.kind === 'move' && <MovementForm key={selection.product.id} product={selection.product} disabled={disabled} onSave={(input) => { if (!disabled) void execute({ kind: 'move', id: crypto.randomUUID(), productId: selection.product.id, input }); }} onCancel={() => setSelection(null)} />}
    {selection?.kind === 'history' && <InventoryHistory key={selection.product.id} uid={uid} product={selection.product} service={service} onClose={() => setSelection(null)} />}
    {selection?.kind === 'valuation' && <ValuationForm product={selection.product} disabled={disabled} onSave={(unitCostMinor) => void execute({ kind: 'valuation', id: crypto.randomUUID(), productId: selection.product.id, unitCostMinor })} onCancel={() => setSelection(null)} />}
    </div>
    <Feedback error={loadError} />
    {loading && <p role="status">Consultando productos…</p>}
    {loadError && <button disabled={!online || busy || loading} onClick={refresh}>Volver a consultar productos</button>}
    {!loading && !loadError && products.length === 0 && <section className="card"><h2>{active ? 'Todavía no tienes productos activos' : 'No hay productos archivados'}</h2><p>{active ? 'Crea tu primer producto para comenzar.' : 'Los productos archivados conservan sus movimientos.'}</p></section>}
    {!loading && !loadError && <ul className="inventory-grid" aria-label="Lista de productos">{products.map((product) => <li className="card product-card" key={product.id}>
      <div className="inventory-toolbar"><h2>{product.name}</h2><span className={`stock-badge ${product.stock < product.minimumStock || product.stock === 0 ? 'warning' : ''}`}>{stockStatus(product)}</span></div>
      <dl><div><dt>Precio</dt><dd>{formatBOB(product.priceMinor)}</dd></div><div><dt>Existencia</dt><dd>{product.stock} unidades</dd></div><div><dt>Mínimo</dt><dd>{product.minimumStock} unidades</dd></div></dl>
      <p>{product.inventoryValueMinor === null ? 'Costo pendiente' : `Valor del inventario: ${formatBOB(product.inventoryValueMinor)} · Costo promedio (aprox.): ${product.stock === 0 ? 'Sin existencias' : formatBOB(product.inventoryValueMinor / product.stock)}`}</p>
      <div className="inventory-actions">
        {product.active && product.inventoryValueMinor === null && <button disabled={disabled} onClick={() => setSelection({ kind: 'valuation', product })} aria-label={`Registrar costo inicial de ${product.name}`}>Registrar costo inicial</button>}
        <button disabled={disabled} onClick={() => setSelection({ kind: 'edit', product })} aria-label={`Editar ${product.name}`}>Editar</button>
        {product.active && <button disabled={disabled || product.inventoryValueMinor === null} onClick={() => setSelection({ kind: 'move', product })} aria-label={`Movimiento de ${product.name}`}>Entrada / salida</button>}
        <button disabled={!online || busy} onClick={() => setSelection({ kind: 'history', product })} aria-label={`Historial de ${product.name}`}>Historial</button>
        <button disabled={disabled} onClick={() => void editOrArchive(() => service.setActive(uid, product.id, !product.active), product.active ? 'Producto archivado. Su historial se conserva.' : 'Producto reactivado.')} aria-label={`${product.active ? 'Archivar' : 'Reactivar'} ${product.name}`}>{product.active ? 'Archivar' : 'Reactivar'}</button>
      </div>
    </li>)}</ul>}
    <div className="inventory-actions">
      {cursor && <button disabled={loading || busy || !online} onClick={() => { setCursor(undefined); setLoading(true); setSelection(null); }}>Primera página</button>}
      {next && <button disabled={loading || busy || !online} onClick={() => { setCursor(next); setLoading(true); setSelection(null); }}>Siguiente página</button>}
    </div>
  </>;
}
