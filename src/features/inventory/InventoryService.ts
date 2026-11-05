import type { InventoryRepository } from './InventoryRepository';
import { integer, MAX_STOCK, productDetails, stockChange } from './domain';
import type { CreateProduct, PageCursor, ProductDetails, StockChange } from './domain';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  list(uid: string, active: boolean, cursor?: PageCursor) {
    return this.repository.list(uid, active, cursor);
  }

  create(uid: string, operationId: string, input: CreateProduct) {
    return this.repository.create(uid, operationId, {
      ...productDetails(input), stock: integer(input.stock, 0, MAX_STOCK, 'Existencia inicial'),
    });
  }

  update(uid: string, productId: string, input: ProductDetails) {
    return this.repository.update(uid, productId, productDetails(input));
  }

  setActive(uid: string, productId: string, active: boolean) {
    return this.repository.setActive(uid, productId, active);
  }

  move(uid: string, productId: string, operationId: string, input: StockChange) {
    return this.repository.move(uid, productId, operationId, stockChange(input));
  }

  history(uid: string, productId: string, cursor?: PageCursor) {
    return this.repository.history(uid, productId, cursor);
  }
}
