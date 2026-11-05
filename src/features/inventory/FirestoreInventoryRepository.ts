import { getDocFromServer, getDocsFromServer, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { InventoryRepository } from './InventoryRepository';
import { createProduct, InventoryInputError, productDetails, resultingStock } from './domain';
import type { CreateProduct, InventoryMovement, Page, PageCursor, Product, ProductDetails, StockChange } from './domain';
import { entryValue, exitValue, inventoryValue, requireValued } from './costing';
import { confirmOperation, decodeMovement, decodeProduct, movements, movementRef, page, pagination, productRef, products } from './firestore-records';

export class FirestoreInventoryRepository implements InventoryRepository {
  constructor(private readonly db: Firestore) {}

  async get(uid: string, productId: string): Promise<Product | null> {
    const snapshot = await getDocFromServer(productRef(this.db, uid, productId));
    return snapshot.exists() ? decodeProduct(snapshot) : null;
  }

  async list(uid: string, active: boolean, cursor?: PageCursor): Promise<Page<Product>> {
    const result = await getDocsFromServer(query(products(this.db, uid), where('active', '==', active), ...pagination(cursor)));
    return page(result.docs, decodeProduct);
  }

  async history(uid: string, productId: string, cursor?: PageCursor): Promise<Page<InventoryMovement>> {
    const result = await getDocsFromServer(query(movements(this.db, uid), where('productId', '==', productId), ...pagination(cursor)));
    return page(result.docs, decodeMovement);
  }

  async create(uid: string, operationId: string, input: CreateProduct): Promise<InventoryMovement> {
    input = createProduct(input);
    const product = productRef(this.db, uid, operationId);
    const movement = movementRef(this.db, uid, operationId);
    const unitCostMinor = input.initialUnitCostMinor ?? 0;
    const value = entryValue(input.stock, unitCostMinor);
    const matches = (saved: InventoryMovement) => saved.kind === 'opening' && saved.productId === operationId
      && saved.stockAfter === input.stock && saved.unitCostMinor === unitCostMinor
      && saved.initialProduct?.name === input.name && saved.initialProduct.priceMinor === input.priceMinor
      && saved.initialProduct.minimumStock === input.minimumStock;
    return confirmOperation(this.db, uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        if (!matches(decodeMovement(previous))) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        return;
      }
      if ((await transaction.get(product)).exists()) throw new Error('El producto ya existe sin el movimiento esperado.');
      const details = productDetails(input);
      transaction.set(product, { ...details, stock: input.stock, inventoryValueMinor: value, active: true, lastMovementId: operationId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.set(movement, {
        productId: operationId, kind: 'opening', delta: input.stock, stockBefore: 0, stockAfter: input.stock,
        valueBeforeMinor: 0, valueAfterMinor: value, unitCostMinor, purchaseId: null,
        reason: 'Stock inicial', authorUid: uid, initialProduct: details, createdAt: serverTimestamp(),
      });
    }));
  }

  async update(uid: string, productId: string, input: ProductDetails): Promise<void> {
    await updateDoc(productRef(this.db, uid, productId), { ...productDetails(input), updatedAt: serverTimestamp() });
  }

  async setActive(uid: string, productId: string, active: boolean): Promise<void> {
    await updateDoc(productRef(this.db, uid, productId), { active, updatedAt: serverTimestamp() });
  }

  async initializeCost(uid: string, productId: string, operationId: string, unitCostMinor: number): Promise<InventoryMovement> {
    const matches = (saved: InventoryMovement) => saved.kind === 'valuation' && saved.productId === productId && saved.unitCostMinor === unitCostMinor;
    return confirmOperation(this.db, uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const movement = movementRef(this.db, uid, operationId);
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        if (!matches(decodeMovement(previous))) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        return;
      }
      const ref = productRef(this.db, uid, productId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new InventoryInputError('No se encontró el producto.');
      const current = decodeProduct(snapshot);
      if (!current.active || current.inventoryValueMinor !== null) throw new InventoryInputError('El producto debe estar activo y tener costo pendiente.');
      const value = entryValue(current.stock, unitCostMinor);
      transaction.update(ref, { inventoryValueMinor: value, lastMovementId: operationId, updatedAt: serverTimestamp() });
      transaction.set(movement, {
        productId, kind: 'valuation', delta: 0, stockBefore: current.stock, stockAfter: current.stock,
        valueBeforeMinor: null, valueAfterMinor: value, unitCostMinor, purchaseId: null,
        reason: 'Valoración inicial', authorUid: uid, initialProduct: null, createdAt: serverTimestamp(),
      });
    }));
  }

  async move(uid: string, productId: string, operationId: string, input: StockChange): Promise<InventoryMovement> {
    const unitCostMinor = input.kind === 'entry' ? input.unitCostMinor! : null;
    const delta = input.kind === 'entry' ? input.quantity : -input.quantity;
    const matches = (saved: InventoryMovement) => saved.productId === productId && saved.kind === input.kind
      && saved.delta === delta && saved.reason === input.reason && saved.unitCostMinor === unitCostMinor;
    return confirmOperation(this.db, uid, operationId, matches, () => runTransaction(this.db, async (transaction) => {
      const movement = movementRef(this.db, uid, operationId);
      const previous = await transaction.get(movement);
      if (previous.exists()) {
        if (!matches(decodeMovement(previous))) throw new InventoryInputError('El identificador ya pertenece a otra operación.');
        return;
      }
      const ref = productRef(this.db, uid, productId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new InventoryInputError('No se encontró el producto.');
      const current = decodeProduct(snapshot);
      if (!current.active) throw new InventoryInputError('Reactiva el producto antes de registrar movimientos.');
      const before = requireValued(current.inventoryValueMinor);
      const stockAfter = resultingStock(current.stock, input);
      const valueAfterMinor = inventoryValue(input.kind === 'entry'
        ? before + entryValue(input.quantity, unitCostMinor!)
        : before - exitValue(before, current.stock, input.quantity));
      transaction.update(ref, { stock: stockAfter, inventoryValueMinor: valueAfterMinor, lastMovementId: operationId, updatedAt: serverTimestamp() });
      transaction.set(movement, {
        productId, kind: input.kind, delta, stockBefore: current.stock, stockAfter,
        valueBeforeMinor: before, valueAfterMinor, unitCostMinor, purchaseId: null,
        reason: input.reason, authorUid: uid, initialProduct: null, createdAt: serverTimestamp(),
      });
    }));
  }
}
