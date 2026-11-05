import type { CreateProduct, InventoryMovement, Page, PageCursor, Product, ProductDetails, StockChange } from './domain';

export interface InventoryRepository {
  list(uid: string, active: boolean, cursor?: PageCursor): Promise<Page<Product>>;
  create(uid: string, operationId: string, input: CreateProduct): Promise<InventoryMovement>;
  update(uid: string, productId: string, details: ProductDetails): Promise<void>;
  setActive(uid: string, productId: string, active: boolean): Promise<void>;
  move(uid: string, productId: string, operationId: string, input: StockChange): Promise<InventoryMovement>;
  history(uid: string, productId: string, cursor?: PageCursor): Promise<Page<InventoryMovement>>;
}
