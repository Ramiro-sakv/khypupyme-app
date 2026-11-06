import { pendingRequestsChanged } from '../../shared/pendingRequests';
import { createProduct, integer, MAX_PRICE_MINOR, stockChange } from './domain';
import type { CreateProduct, StockChange } from './domain';
import type { InventoryService } from './InventoryService';
import { identifier, purchaseInput } from '../purchases/domain';
import type { PurchaseInput } from '../purchases/domain';
import type { PurchaseService } from '../purchases/PurchaseService';

export type PendingOperation =
  | { kind: 'create'; id: string; input: CreateProduct }
  | { kind: 'move'; id: string; productId: string; input: StockChange }
  | { kind: 'valuation'; id: string; productId: string; unitCostMinor: number }
  | { kind: 'purchase'; id: string; input: PurchaseInput }
  | { kind: 'reverse'; id: string; purchaseId: string; reason: string };

const key = (uid: string) => `khypupyme:pending-inventory:${uid}`;

export function readPending(uid: string): PendingOperation | null {
  const text = sessionStorage.getItem(key(uid));
  if (!text) return null;
  const data = JSON.parse(text) as PendingOperation;
  if (!data || typeof data.id !== 'string') throw new Error('Operación pendiente inválida.');
  identifier(data.id);
  switch (data.kind) {
    case 'create':
      return { ...data, input: createProduct(data.input) };
    case 'move':
      return { ...data, productId: identifier(data.productId), input: stockChange(data.input) };
    case 'valuation':
      return {
        ...data,
        productId: identifier(data.productId),
        unitCostMinor: integer(data.unitCostMinor, 0, MAX_PRICE_MINOR, 'Costo inicial'),
      };
    case 'purchase':
      return { ...data, input: purchaseInput(data.input) };
    case 'reverse':
      if (typeof data.reason !== 'string') throw new Error('Operación pendiente inválida.');
      return { ...data, purchaseId: identifier(data.purchaseId) };
    default:
      throw new Error('Operación pendiente inválida.');
  }
}

export function savePending(uid: string, operation: PendingOperation): void {
  // Una solicitud por cuenta/pestaña. Nunca se reenvía automáticamente.
  sessionStorage.setItem(key(uid), JSON.stringify(operation));
  pendingRequestsChanged();
}
export function clearPending(uid: string): void {
  sessionStorage.removeItem(key(uid));
  pendingRequestsChanged();
}

export async function executePending(
  uid: string,
  operation: PendingOperation,
  inventory: InventoryService,
  purchases: PurchaseService,
): Promise<void> {
  switch (operation.kind) {
    case 'create':
      await inventory.create(uid, operation.id, operation.input);
      return;
    case 'move':
      await inventory.move(uid, operation.productId, operation.id, operation.input);
      return;
    case 'valuation':
      await inventory.initializeCost(
        uid,
        operation.productId,
        operation.id,
        operation.unitCostMinor,
      );
      return;
    case 'purchase':
      await purchases.create(uid, operation.id, operation.input);
      return;
    case 'reverse':
      await purchases.reverse(uid, operation.purchaseId, operation.id, operation.reason);
      return;
  }
}

export function pendingLabel(operation: PendingOperation): string {
  switch (operation.kind) {
    case 'create':
      return `Creación de ${operation.input.name}, con ${operation.input.stock} unidades.`;
    case 'move':
      return `${operation.input.kind === 'entry' ? 'Entrada' : 'Salida'} de ${operation.input.quantity} unidades. Motivo: ${operation.input.reason}`;
    case 'valuation':
      return 'Valoración inicial de las existencias.';
    case 'purchase':
      return `Compra de ${operation.input.quantity} unidades, fecha ${operation.input.date}.`;
    case 'reverse':
      return `Anulación de compra. Motivo: ${operation.reason}`;
  }
}
