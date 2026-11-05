import { singleLine } from '../inventory/domain';
import type { PurchaseRepository } from './PurchaseRepository';
import { identifier, purchaseFilter, purchaseInput } from './domain';
import type { PurchaseCursor, PurchaseFilter, PurchaseInput } from './domain';

export class PurchaseService {
  constructor(private readonly repository: PurchaseRepository) {}

  list(uid: string, filter: PurchaseFilter, cursor?: PurchaseCursor) {
    return this.repository.list(uid, purchaseFilter(filter), cursor);
  }
  create(uid: string, operationId: string, input: PurchaseInput) {
    return this.repository.create(uid, identifier(operationId), purchaseInput(input));
  }
  reverse(uid: string, purchaseId: string, operationId: string, reason: string) {
    return this.repository.reverse(uid, identifier(purchaseId), identifier(operationId), singleLine(reason, 3, 200, 'Motivo de anulación'));
  }
  isReversed(uid: string, purchaseId: string) { return this.repository.isReversed(uid, identifier(purchaseId)); }
}
