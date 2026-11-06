import type { ProductSpecification } from '../../../shared/product-specification';
import {
  identifier,
  integer,
  InventoryInputError,
  MAX_PRICE_MINOR,
  MAX_STOCK,
  singleLine,
} from '../inventory/domain';
export { identifier } from '../inventory/domain';
import type { PageCursor } from '../inventory/domain';
import { entryValue } from '../inventory/costing';

export interface PurchaseInput {
  productId: string;
  quantity: number;
  unitCostMinor: number;
  date: string;
  reference: string;
}

export interface Purchase extends PurchaseInput {
  specification?: ProductSpecification;
  id: string;
  productName: string;
  totalMinor: number;
  stockBefore: number;
  stockAfter: number;
  valueBeforeMinor: number;
  valueAfterMinor: number;
  authorUid: string;
  createdAt: Date;
}

export interface PurchaseFilter {
  from: string;
  to: string;
  productId?: string;
}
export interface PurchaseCursor extends PageCursor {
  date: string;
}

export function businessDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new InventoryInputError('Fecha inválida; usa una fecha entre 2000 y 2099.');
  }
  return value;
}

export function todayInBolivia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function purchaseInput(input: PurchaseInput): PurchaseInput {
  const quantity = integer(input.quantity, 1, MAX_STOCK, 'Cantidad de compra');
  const unitCostMinor = integer(
    input.unitCostMinor,
    1,
    MAX_PRICE_MINOR,
    'Costo unitario en centavos',
  );
  entryValue(quantity, unitCostMinor);
  return {
    productId: identifier(input.productId),
    quantity,
    unitCostMinor,
    date: businessDate(input.date),
    reference:
      input.reference.trim() === '' ? '' : singleLine(input.reference, 1, 100, 'Referencia'),
  };
}

export function purchaseFilter(input: PurchaseFilter): PurchaseFilter {
  const from = businessDate(input.from),
    to = businessDate(input.to);
  if (from > to)
    throw new InventoryInputError('La fecha inicial no puede ser posterior a la final.');
  return { from, to, ...(input.productId ? { productId: identifier(input.productId) } : {}) };
}
