import { integer, MAX_STOCK, productDetails, stockChange } from './domain';
import type { CreateProduct, StockChange } from './domain';

export type PendingOperation =
  | { kind: 'create'; id: string; input: CreateProduct }
  | { kind: 'move'; id: string; productId: string; input: StockChange };

const key = (uid: string) => `khypupyme:pending-inventory:${uid}`;

export function readPending(uid: string): PendingOperation | null {
  const text = sessionStorage.getItem(key(uid));
  if (!text) return null;
  const data = JSON.parse(text) as PendingOperation;
  if (!data || typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.id)) throw new Error('Operación pendiente inválida.');
  if (data.kind === 'create') return {
    kind: 'create', id: data.id,
    input: { ...productDetails(data.input), stock: integer(data.input.stock, 0, MAX_STOCK, 'Existencia inicial') },
  };
  if (data.kind === 'move' && typeof data.productId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(data.productId)) {
    return { kind: 'move', id: data.id, productId: data.productId, input: stockChange(data.input) };
  }
  throw new Error('Operación pendiente inválida.');
}

export function savePending(uid: string, operation: PendingOperation): void {
  // Solo intención de una operación de esta pestaña: no hay cola ni reenvío automático al recuperar conexión.
  sessionStorage.setItem(key(uid), JSON.stringify(operation));
}

export function clearPending(uid: string): void { sessionStorage.removeItem(key(uid)); }
