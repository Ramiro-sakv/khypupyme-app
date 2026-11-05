import { collection, doc, limit, orderBy, documentId, runTransaction, startAfter, Timestamp } from 'firebase/firestore';
import type { DocumentSnapshot, Firestore, QueryConstraint } from 'firebase/firestore';
import { identifier, integer, InventoryInputError, MAX_STOCK, PAGE_SIZE, productDetails } from './domain';
import type { InventoryMovement, Page, PageCursor, Product, ProductDetails } from './domain';
import { inventoryValue } from './costing';

export const products = (db: Firestore, uid: string) => collection(db, 'businesses', identifier(uid), 'products');
export const movements = (db: Firestore, uid: string) => collection(db, 'businesses', identifier(uid), 'inventoryMovements');
export const productRef = (db: Firestore, uid: string, id: string) => doc(products(db, uid), identifier(id));
export const movementRef = (db: Firestore, uid: string, id: string) => doc(movements(db, uid), identifier(id));

export function timestamp(value: unknown): Date {
  if (!(value instanceof Timestamp)) throw new Error('Fecha almacenada inválida.');
  return value.toDate();
}

export function decodeProduct(snapshot: DocumentSnapshot): Product {
  const data = snapshot.data();
  if (!data || typeof data.active !== 'boolean' || typeof data.lastMovementId !== 'string') throw new Error('Producto almacenado inválido.');
  return {
    id: snapshot.id, ...productDetails(data as ProductDetails),
    stock: integer(data.stock as number, 0, MAX_STOCK, 'Existencia'),
    inventoryValueMinor: data.inventoryValueMinor === undefined ? null : inventoryValue(data.inventoryValueMinor as number),
    active: data.active, lastMovementId: data.lastMovementId,
    createdAt: timestamp(data.createdAt), updatedAt: timestamp(data.updatedAt),
  };
}

export function decodeMovement(snapshot: DocumentSnapshot): InventoryMovement {
  const data = snapshot.data();
  if (!data || !['opening', 'entry', 'exit', 'valuation', 'purchase', 'purchase-reversal', 'sale', 'sale-reversal'].includes(data.kind as string)
    || typeof data.productId !== 'string' || typeof data.authorUid !== 'string' || typeof data.reason !== 'string') {
    throw new Error('Movimiento almacenado inválido.');
  }
  return {
    id: snapshot.id, productId: data.productId, kind: data.kind as InventoryMovement['kind'],
    delta: integer(data.delta as number, -MAX_STOCK, MAX_STOCK, 'Variación'),
    stockBefore: integer(data.stockBefore as number, 0, MAX_STOCK, 'Existencia anterior'),
    stockAfter: integer(data.stockAfter as number, 0, MAX_STOCK, 'Existencia posterior'),
    reason: data.reason, authorUid: data.authorUid, createdAt: timestamp(data.createdAt),
    initialProduct: data.initialProduct === null ? null : productDetails(data.initialProduct as ProductDetails),
    valueBeforeMinor: data.valueBeforeMinor == null ? null : inventoryValue(data.valueBeforeMinor as number),
    valueAfterMinor: data.valueAfterMinor == null ? null : inventoryValue(data.valueAfterMinor as number),
    unitCostMinor: typeof data.unitCostMinor === 'number' ? data.unitCostMinor : null,
    purchaseId: typeof data.purchaseId === 'string' ? data.purchaseId : null,
  };
}

export function page<T>(snapshots: DocumentSnapshot[], decode: (snapshot: DocumentSnapshot) => T): Page<T> {
  const visible = snapshots.slice(0, PAGE_SIZE), last = visible.at(-1);
  const time: unknown = last?.get('createdAt');
  return {
    items: visible.map(decode),
    next: snapshots.length > PAGE_SIZE && last && time instanceof Timestamp
      ? { seconds: time.seconds, nanoseconds: time.nanoseconds, id: last.id } : null,
  };
}

export function pagination(cursor?: PageCursor): QueryConstraint[] {
  return [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'),
    ...(cursor ? [startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), identifier(cursor.id))] : []), limit(PAGE_SIZE + 1)];
}

export async function readMovement(db: Firestore, uid: string, id: string): Promise<InventoryMovement | null> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(movementRef(db, uid, id));
    return snapshot.exists() ? decodeMovement(snapshot) : null;
  });
}

export async function confirmOperation(db: Firestore, uid: string, id: string, matches: (saved: InventoryMovement) => boolean, write: () => Promise<void>): Promise<InventoryMovement> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await write();
      const saved = await readMovement(db, uid, id);
      if (!saved) throw new Error('Vuelve a consultar la operación para confirmar el resultado.');
      if (!matches(saved)) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
      return saved;
    } catch (cause) {
      if (cause instanceof InventoryInputError) throw cause;
      let saved: InventoryMovement | null;
      try { saved = await readMovement(db, uid, id); } catch { throw cause; }
      if (saved) {
        if (!matches(saved)) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        return saved;
      }
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : '';
      if (attempt === 2 || (code !== 'permission-denied' && code !== 'aborted')) throw cause;
    }
  }
  throw new Error('No se pudo confirmar la operación.');
}
