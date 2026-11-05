import { useEffect, useRef, useState } from 'react';
import { Feedback } from '../../shared/components/Feedback';
import { errorMessage } from '../../shared/errors';
import type { InventoryService } from '../inventory/InventoryService';
import type { PageCursor, Product } from '../inventory/domain';

export function ProductSelector({ uid, service, selected, onChange, disabled, includeArchived = false, id }: {
  uid: string; service: InventoryService; selected: Product | null; onChange: (product: Product | null) => void;
  disabled: boolean; includeArchived?: boolean; id: string;
}) {
  const [items, setItems] = useState<Product[]>(selected ? [selected] : []);
  const [more, setMore] = useState<{ active: boolean; cursor?: PageCursor } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    let current = true; alive.current = true;
    service.list(uid, true).then((result) => {
      if (!current) return;
      setItems((old) => [...new Map([...old, ...result.items].map((item) => [item.id, item])).values()]);
      setMore(result.next ? { active: true, cursor: result.next } : includeArchived ? { active: false } : null);
      setLoading(false);
    }, (cause) => { if (current) { setError(errorMessage(cause)); setLoading(false); } });
    return () => { current = false; alive.current = false; };
  }, [uid, service, includeArchived]);
  async function loadMore() {
    if (lock.current || disabled) return;
    lock.current = true; setLoading(true); setError('');
    const request = more ?? { active: true };
    try {
      const result = await service.list(uid, request.active, request.cursor);
      if (!alive.current) return;
      setItems((old) => [...new Map([...old, ...result.items].map((item) => [item.id, item])).values()]);
      setMore(result.next ? { active: request.active, cursor: result.next } : includeArchived && request.active ? { active: false } : null);
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setLoading(false); }
  }
  return <>
    <select id={id} value={selected?.id ?? ''} disabled={disabled || loading} onChange={(event) => onChange(items.find((item) => item.id === event.target.value) ?? null)}>
      <option value="">{includeArchived ? 'Todos los productos' : 'Selecciona un producto'}</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active ? ' (archivado)' : item.inventoryValueMinor === null ? ' (costo pendiente)' : ''}</option>)}
    </select>
    {loading && <p role="status">Consultando catálogo…</p>}
    <Feedback error={error} />
    {(more || error) && <button type="button" disabled={disabled || loading} onClick={() => void loadMore()}>{error ? 'Volver a consultar catálogo' : 'Cargar más productos'}</button>}
  </>;
}
