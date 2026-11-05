import type { Page } from '../inventory/domain';
import type { Purchase, PurchaseCursor, PurchaseFilter, PurchaseInput } from './domain';

export interface PurchaseRepository {
  list(uid: string, filter: PurchaseFilter, cursor?: PurchaseCursor): Promise<Page<Purchase> & { next: PurchaseCursor | null }>;
  create(uid: string, operationId: string, input: PurchaseInput): Promise<Purchase>;
  reverse(uid: string, purchaseId: string, operationId: string, reason: string): Promise<void>;
  isReversed(uid: string, purchaseId: string): Promise<boolean>;
}
