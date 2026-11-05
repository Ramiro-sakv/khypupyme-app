import { useEffect, useRef, useState } from 'react';
import { Feedback } from '../../shared/components/Feedback';
import { errorMessage } from '../../shared/errors';
import { useOnline } from '../../shared/hooks/useOnline';
import type { InventoryService } from './InventoryService';
import type { InventoryMovement, PageCursor, Product } from './domain';

const labels = { opening: 'Stock inicial', entry: 'Entrada', exit: 'Salida' };
export function InventoryHistory({ uid, product, service, onClose }: {
  uid: string; product: Product; service: InventoryService; onClose: () => void;
}) {
  const online = useOnline();
  const [items, setItems] = useState<InventoryMovement[]>([]);
  const [next, setNext] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    service.history(uid, product.id).then((result) => {
      if (alive.current) { setItems(result.items); setNext(result.next); setLoading(false); }
    }, (cause) => { if (alive.current) { setError(errorMessage(cause)); setLoading(false); } });
    return () => { alive.current = false; };
  }, [uid, product.id, service]);
  async function loadMore() {
    if (lock.current || !online) return;
    lock.current = true; setLoading(true); setError('');
    try {
      const result = await service.history(uid, product.id, next ?? undefined);
      if (alive.current) { setItems((old) => next ? [...old, ...result.items] : result.items); setNext(result.next); }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setLoading(false); }
  }
  return <section className="card inventory-editor" aria-label="Historial de movimientos">
    <div className="inventory-toolbar"><h2 tabIndex={-1}>Historial de {product.name}</h2><button onClick={onClose}>Cerrar historial</button></div>
    <Feedback error={error} />{loading && <p role="status">Consultando movimientos…</p>}
    {!loading && !error && items.length === 0 && <p>No hay movimientos registrados.</p>}
    <ol className="inventory-history">{items.map((movement) => <li key={movement.id}>
      <strong>{labels[movement.kind]} · {movement.delta > 0 ? '+' : ''}{movement.delta} unidades</strong>
      <span>{movement.reason}</span><span>{movement.stockBefore} → {movement.stockAfter} unidades</span>
      <time dateTime={movement.createdAt.toISOString()}>{movement.createdAt.toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</time>
    </li>)}</ol>
    {(next || error) && <button onClick={() => void loadMore()} disabled={loading || !online}>{error ? 'Volver a consultar historial' : 'Ver más movimientos'}</button>}
  </section>;
}
