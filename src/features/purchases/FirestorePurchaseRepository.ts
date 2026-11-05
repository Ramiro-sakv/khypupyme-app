import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, Timestamp, where } from 'firebase/firestore';
import type { DocumentSnapshot, Firestore } from 'firebase/firestore';
import { InventoryInputError, PAGE_SIZE } from '../inventory/domain';
import { entryValue, inventoryValue, requireValued } from '../inventory/costing';
import { confirmOperation, decodeMovement, decodeProduct, movementRef, productRef, timestamp } from '../inventory/firestore-records';
import type { PurchaseRepository } from './PurchaseRepository';
import { identifier, purchaseInput } from './domain';
import type { Purchase, PurchaseCursor, PurchaseFilter, PurchaseInput } from './domain';

function decode(snapshot: DocumentSnapshot): Purchase {
  const data = snapshot.data();
  if (!data || typeof data.productName !== 'string' || typeof data.authorUid !== 'string') throw new Error('Compra almacenada inválida.');
  return {
    id: snapshot.id, ...purchaseInput(data as PurchaseInput), productName: data.productName, authorUid: data.authorUid,
    totalMinor: inventoryValue(data.totalMinor as number), stockBefore: data.stockBefore as number, stockAfter: data.stockAfter as number,
    valueBeforeMinor: inventoryValue(data.valueBeforeMinor as number), valueAfterMinor: inventoryValue(data.valueAfterMinor as number),
    createdAt: timestamp(data.createdAt),
  };
}

function sameRequest(saved: Purchase, input: PurchaseInput): boolean {
  return saved.productId === input.productId && saved.quantity === input.quantity && saved.unitCostMinor === input.unitCostMinor
    && saved.date === input.date && saved.reference === input.reference;
}

export class FirestorePurchaseRepository implements PurchaseRepository {
  constructor(private readonly db: Firestore) {}

  private purchases(uid: string) { return collection(this.db, 'businesses', identifier(uid), 'purchases'); }
  private ref(uid: string, id: string) { return doc(this.purchases(uid), identifier(id)); }
  private reversal(uid: string, id: string) { return doc(this.db, 'businesses', identifier(uid), 'purchaseReversals', identifier(id)); }

  async list(uid: string, filter: PurchaseFilter, cursor?: PurchaseCursor) {
    const result = await getDocsFromServer(query(this.purchases(uid),
      where('date', '>=', filter.from), where('date', '<=', filter.to),
      ...(filter.productId ? [where('productId', '==', filter.productId)] : []),
      orderBy('date', 'desc'), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'),
      ...(cursor ? [startAfter(cursor.date, new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id)] : []), limit(PAGE_SIZE + 1)));
    const visible = result.docs.slice(0, PAGE_SIZE), last = visible.at(-1);
    const time: unknown = last?.get('createdAt');
    return {
      items: visible.map(decode),
      next: result.docs.length > PAGE_SIZE && last && time instanceof Timestamp
        ? { date: last.get('date') as string, seconds: time.seconds, nanoseconds: time.nanoseconds, id: last.id } : null,
    };
  }

  async create(uid: string, operationId: string, input: PurchaseInput): Promise<Purchase> {
    input = purchaseInput(input);
    const ref = this.ref(uid, operationId);
    const movement = movementRef(this.db, uid, operationId);
    const totalMinor = entryValue(input.quantity, input.unitCostMinor);
    const matches = (saved: ReturnType<typeof decodeMovement>) => saved.kind === 'purchase' && saved.purchaseId === operationId
      && saved.productId === input.productId && saved.delta === input.quantity && saved.unitCostMinor === input.unitCostMinor;
    await confirmOperation(this.db, uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(ref);
      const previousMovement = await transaction.get(movement);
      if (previous.exists() || previousMovement.exists()) {
        if (!previous.exists() || !previousMovement.exists() || !sameRequest(decode(previous), input) || !matches(decodeMovement(previousMovement))) {
          throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        }
        return;
      }
      const product = productRef(this.db, uid, input.productId);
      const snapshot = await transaction.get(product);
      if (!snapshot.exists()) throw new InventoryInputError('No se encontró el producto.');
      const current = decodeProduct(snapshot);
      if (!current.active) throw new InventoryInputError('Reactiva el producto antes de comprar.');
      const valueBeforeMinor = requireValued(current.inventoryValueMinor);
      const stockAfter = current.stock + input.quantity;
      if (stockAfter > 1_000_000) throw new InventoryInputError('La compra supera el límite de existencias.');
      const valueAfterMinor = inventoryValue(valueBeforeMinor + totalMinor);
      transaction.update(product, { stock: stockAfter, inventoryValueMinor: valueAfterMinor, lastMovementId: operationId, updatedAt: serverTimestamp() });
      transaction.set(ref, {
        ...input, productName: current.name, totalMinor, stockBefore: current.stock, stockAfter,
        valueBeforeMinor, valueAfterMinor, authorUid: uid, createdAt: serverTimestamp(),
      });
      transaction.set(movement, {
        productId: input.productId, kind: 'purchase', delta: input.quantity, stockBefore: current.stock, stockAfter,
        valueBeforeMinor, valueAfterMinor, unitCostMinor: input.unitCostMinor, purchaseId: operationId,
        reason: 'Compra', authorUid: uid, initialProduct: null, createdAt: serverTimestamp(),
      });
    }));
    const saved = decode(await getDocFromServer(ref));
    if (!sameRequest(saved, input)) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
    return saved;
  }

  async isReversed(uid: string, purchaseId: string): Promise<boolean> {
    return (await getDocFromServer(this.reversal(uid, purchaseId))).exists();
  }

  async reverse(uid: string, purchaseId: string, operationId: string, reason: string): Promise<void> {
    const movement = movementRef(this.db, uid, operationId);
    const matches = (saved: ReturnType<typeof decodeMovement>) => saved.kind === 'purchase-reversal'
      && saved.purchaseId === purchaseId && saved.reason === reason;
    await confirmOperation(this.db, uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        if (!matches(decodeMovement(previous))) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        return;
      }
      const purchase = await transaction.get(this.ref(uid, purchaseId));
      const reversal = this.reversal(uid, purchaseId);
      if (!purchase.exists()) throw new InventoryInputError('No se encontró la compra.');
      if ((await transaction.get(reversal)).exists()) throw new InventoryInputError('La compra ya está anulada.');
      const saved = decode(purchase);
      const product = productRef(this.db, uid, saved.productId);
      const snapshot = await transaction.get(product);
      if (!snapshot.exists()) throw new InventoryInputError('No se encontró el producto.');
      const current = decodeProduct(snapshot);
      if (!current.active || current.lastMovementId !== purchaseId || current.stock !== saved.stockAfter || current.inventoryValueMinor !== saved.valueAfterMinor) {
        throw new InventoryInputError('Solo puedes anular una compra activa sin movimientos posteriores.');
      }
      transaction.update(product, { stock: saved.stockBefore, inventoryValueMinor: saved.valueBeforeMinor, lastMovementId: operationId, updatedAt: serverTimestamp() });
      transaction.set(reversal, { purchaseId, operationId, reason, authorUid: uid, createdAt: serverTimestamp() });
      transaction.set(movement, {
        productId: saved.productId, kind: 'purchase-reversal', delta: -saved.quantity,
        stockBefore: saved.stockAfter, stockAfter: saved.stockBefore, valueBeforeMinor: saved.valueAfterMinor, valueAfterMinor: saved.valueBeforeMinor,
        unitCostMinor: null, purchaseId, reason, authorUid: uid, initialProduct: null, createdAt: serverTimestamp(),
      });
    }));
  }
}
