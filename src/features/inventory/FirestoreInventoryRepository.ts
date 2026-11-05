import {
  collection, doc, documentId, getDocsFromServer, limit, orderBy, query,
  runTransaction, serverTimestamp, startAfter, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import type { DocumentSnapshot, Firestore, QueryConstraint } from 'firebase/firestore';
import type { InventoryRepository } from './InventoryRepository';
import { integer, InventoryInputError, MAX_STOCK, PAGE_SIZE, productDetails, resultingStock } from './domain';
import type { CreateProduct, InventoryMovement, Page, PageCursor, Product, ProductDetails, StockChange } from './domain';

function identifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error('Identificador inválido.');
  return value;
}

function timestamp(value: unknown): Date {
  if (!(value instanceof Timestamp)) throw new Error('Fecha almacenada inválida.');
  return value.toDate();
}

function decodeProduct(snapshot: DocumentSnapshot): Product {
  const data = snapshot.data();
  if (!data || typeof data.active !== 'boolean' || typeof data.lastMovementId !== 'string') throw new Error('Producto almacenado inválido.');
  return {
    id: snapshot.id, ...productDetails(data as ProductDetails),
    stock: integer(data.stock as number, 0, MAX_STOCK, 'Existencia'),
    active: data.active, lastMovementId: data.lastMovementId,
    createdAt: timestamp(data.createdAt), updatedAt: timestamp(data.updatedAt),
  };
}

function decodeMovement(snapshot: DocumentSnapshot): InventoryMovement {
  const data = snapshot.data();
  if (!data || !['opening', 'entry', 'exit'].includes(data.kind as string)
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
  };
}

function page<T>(snapshots: DocumentSnapshot[], decode: (snapshot: DocumentSnapshot) => T): Page<T> {
  const visible = snapshots.slice(0, PAGE_SIZE);
  const last = visible.at(-1);
  const time: unknown = last?.get('createdAt');
  return {
    items: visible.map(decode),
    next: snapshots.length > PAGE_SIZE && last && time instanceof Timestamp
      ? { seconds: time.seconds, nanoseconds: time.nanoseconds, id: last.id } : null,
  };
}

function pagination(cursor?: PageCursor): QueryConstraint[] {
  return [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'),
    ...(cursor ? [startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), identifier(cursor.id))] : []), limit(PAGE_SIZE + 1)];
}

function sameDetails(a: ProductDetails | null, b: ProductDetails): boolean {
  return a !== null && a.name === b.name && a.priceMinor === b.priceMinor && a.minimumStock === b.minimumStock;
}

export class FirestoreInventoryRepository implements InventoryRepository {
  constructor(private readonly db: Firestore) {}

  private products(uid: string) { return collection(this.db, 'businesses', identifier(uid), 'products'); }
  private movements(uid: string) { return collection(this.db, 'businesses', identifier(uid), 'inventoryMovements'); }

  async list(uid: string, active: boolean, cursor?: PageCursor): Promise<Page<Product>> {
    const result = await getDocsFromServer(query(this.products(uid), where('active', '==', active), ...pagination(cursor)));
    return page(result.docs, decodeProduct);
  }

  async history(uid: string, productId: string, cursor?: PageCursor): Promise<Page<InventoryMovement>> {
    const result = await getDocsFromServer(query(this.movements(uid), where('productId', '==', identifier(productId)), ...pagination(cursor)));
    return page(result.docs, decodeMovement);
  }

  async create(uid: string, operationId: string, input: CreateProduct): Promise<InventoryMovement> {
    const product = doc(this.products(uid), identifier(operationId));
    const movement = doc(this.movements(uid), operationId);
    const matches = (saved: InventoryMovement) => saved.kind === 'opening' && saved.productId === operationId
      && saved.stockAfter === input.stock && sameDetails(saved.initialProduct, input);
    return this.confirmOperation(uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        const saved = decodeMovement(previous);
        if (!matches(saved)) {
          throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        }
        return;
      }
      if ((await transaction.get(product)).exists()) throw new Error('El producto ya existe sin el movimiento esperado.');
      const details = productDetails(input);
      const entry = {
        productId: operationId, kind: 'opening' as const, delta: input.stock,
        stockBefore: 0, stockAfter: input.stock, reason: 'Stock inicial', authorUid: uid, initialProduct: details,
      };
      transaction.set(product, { ...details, stock: input.stock, active: true, lastMovementId: operationId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.set(movement, { ...entry, createdAt: serverTimestamp() });
    }));
  }

  private async confirmOperation(uid: string, operationId: string, matches: (saved: InventoryMovement) => boolean, write: () => Promise<void>): Promise<InventoryMovement> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await write(); return await this.confirmMovement(uid, operationId); }
      catch (cause) {
        if (cause instanceof InventoryInputError) throw cause;
        // Un resultado incierto solo se confirma leyendo el registro inmutable, con la misma solicitud.
        let saved: InventoryMovement | null;
        try { saved = await this.readMovement(uid, operationId); }
        catch { throw cause; }
        if (saved) {
          if (!matches(saved)) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
          return saved;
        }
        const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : '';
        // Las reglas pueden rechazar una vista antigua antes de que el SDK reciba ABORTED.
        // Sin movimiento confirmado, una nueva transacción recalcula sobre el stock actual.
        if (attempt === 2 || (code !== 'permission-denied' && code !== 'aborted')) throw cause;
      }
    }
    throw new Error('No se pudo confirmar la operación.');
  }

  private async confirmMovement(uid: string, operationId: string): Promise<InventoryMovement> {
    const result = await this.readMovement(uid, operationId);
    if (!result) throw new Error('Vuelve a consultar la operación para confirmar el resultado.');
    return result;
  }

  private async readMovement(uid: string, operationId: string): Promise<InventoryMovement | null> {
    // Una transacción de solo lectura consulta el servidor y no acepta escrituras pendientes de caché.
    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(doc(this.movements(uid), identifier(operationId)));
      return snapshot.exists() ? decodeMovement(snapshot) : null;
    });
  }

  async update(uid: string, productId: string, input: ProductDetails): Promise<void> {
    await updateDoc(doc(this.products(uid), identifier(productId)), { ...productDetails(input), updatedAt: serverTimestamp() });
  }

  async setActive(uid: string, productId: string, active: boolean): Promise<void> {
    await updateDoc(doc(this.products(uid), identifier(productId)), { active, updatedAt: serverTimestamp() });
  }

  async move(uid: string, productId: string, operationId: string, input: StockChange): Promise<InventoryMovement> {
    const product = doc(this.products(uid), identifier(productId));
    const movement = doc(this.movements(uid), identifier(operationId));
    const delta = input.kind === 'entry' ? input.quantity : -input.quantity;
    const matches = (saved: InventoryMovement) => saved.productId === productId && saved.kind === input.kind
      && saved.delta === delta && saved.reason === input.reason;
    return this.confirmOperation(uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        const saved = decodeMovement(previous);
        if (!matches(saved)) {
          throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        }
        return;
      }
      const snapshot = await transaction.get(product);
      if (!snapshot.exists()) throw new InventoryInputError('No se encontró el producto.');
      const current = decodeProduct(snapshot);
      if (!current.active) throw new InventoryInputError('Reactiva el producto antes de registrar movimientos.');
      const stockAfter = resultingStock(current.stock, input);
      transaction.update(product, { stock: stockAfter, lastMovementId: operationId, updatedAt: serverTimestamp() });
      transaction.set(movement, {
        productId, kind: input.kind, delta, stockBefore: current.stock, stockAfter,
        reason: input.reason, authorUid: uid, initialProduct: null, createdAt: serverTimestamp(),
      });
    }));
  }
}
