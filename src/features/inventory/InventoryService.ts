import type { InventoryRepository } from './InventoryRepository';
import { createProduct, integer, MAX_PRICE_MINOR, productDetails, stockChange } from './domain';
import type { CreateProduct, PageCursor, ProductDetails, StockChange } from './domain';
import { entryValue } from './costing';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  list(uid: string, active: boolean, cursor?: PageCursor) {
    return this.repository.list(uid, active, cursor);
  }

  get(uid: string, productId: string) { return this.repository.get(uid, productId); }

  create(uid: string, operationId: string, input: CreateProduct) {
    const normalized = createProduct(input);
    entryValue(normalized.stock, normalized.initialUnitCostMinor!);
    return this.repository.create(uid, operationId, normalized);
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

  initializeCost(uid: string, productId: string, operationId: string, unitCostMinor: number) {
    return this.repository.initializeCost(uid, productId, operationId, integer(unitCostMinor, 0, MAX_PRICE_MINOR, 'Costo inicial'));
  }
}
