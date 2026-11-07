import { validateSpecification } from './product-specification.js';
import type { ProductSpecification } from './product-specification.js';
export const MAX_STOCK = 1_000_000;
export const MAX_PRICE_MINOR = 999_999_999;
export const PAGE_SIZE = 25;

// Rechazo conocido antes de escribir; se puede corregir sin dejar una operación incierta.
export class InventoryInputError extends Error {}

export function identifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new InventoryInputError('Identificador inválido.');
  return value;
}

export interface ProductDetails {
  specification?: ProductSpecification;
  name: string;
  priceMinor: number;
  minimumStock: number;
}

export interface Product extends ProductDetails {
  id: string;
  stock: number;
  inventoryValueMinor: number | null;
  active: boolean;
  lastMovementId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  kind:
    | 'opening'
    | 'entry'
    | 'exit'
    | 'valuation'
    | 'purchase'
    | 'purchase-reversal'
    | 'sale'
    | 'sale-reversal';
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  authorUid: string;
  createdAt: Date;
  initialProduct: ProductDetails | null;
  valueBeforeMinor: number | null;
  valueAfterMinor: number | null;
  unitCostMinor: number | null;
  purchaseId: string | null;
}

// El cursor pertenece al dominio; ningún componente necesita tipos de Firebase.
export interface PageCursor {
  seconds: number;
  nanoseconds: number;
  id: string;
}
export interface Page<T> {
  items: T[];
  next: PageCursor | null;
}
export interface CreateProduct extends ProductDetails {
  stock: number;
  initialUnitCostMinor?: number;
}
export interface StockChange {
  kind: 'entry' | 'exit';
  quantity: number;
  reason: string;
  unitCostMinor?: number;
}

export function singleLine(value: string, min: number, max: number, label: string): string {
  const result = value.trim();
  if (result.length < min || result.length > max || /[\r\n]/.test(result)) {
    throw new InventoryInputError(
      `${label}: usa entre ${min} y ${max} caracteres en una sola línea.`,
    );
  }
  return result;
}

export function integer(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new InventoryInputError(`${label}: usa un número entero entre ${min} y ${max}.`);
  }
  return value;
}

export function productDetails(value: ProductDetails): ProductDetails {
  let specification: ProductSpecification | undefined;
  try {
    specification =
      value.specification === undefined ? undefined : validateSpecification(value.specification);
  } catch (cause) {
    throw new InventoryInputError((cause as Error).message);
  }
  return {
    ...(specification ? { specification } : {}),
    name: singleLine(value.name, 2, 80, 'Nombre'),
    priceMinor: integer(value.priceMinor, 1, MAX_PRICE_MINOR, 'Precio en centavos'),
    minimumStock: integer(value.minimumStock, 0, MAX_STOCK, 'Existencia mínima'),
  };
}

export function stockChange(value: StockChange): StockChange {
  if (value.kind !== 'entry' && value.kind !== 'exit')
    throw new InventoryInputError('Tipo de movimiento inválido.');
  const result: StockChange = {
    kind: value.kind,
    quantity: integer(value.quantity, 1, MAX_STOCK, 'Cantidad'),
    reason: singleLine(value.reason, 3, 200, 'Motivo'),
  };
  if (value.kind === 'entry')
    result.unitCostMinor = integer(
      value.unitCostMinor ?? Number.NaN,
      0,
      MAX_PRICE_MINOR,
      'Costo unitario de entrada',
    );
  return result;
}

export function createProduct(value: CreateProduct): CreateProduct {
  const stock = integer(value.stock, 0, MAX_STOCK, 'Existencia inicial');
  const cost =
    stock === 0
      ? 0
      : integer(
          value.initialUnitCostMinor ?? Number.NaN,
          0,
          MAX_PRICE_MINOR,
          'Costo unitario inicial',
        );
  return { ...productDetails(value), stock, initialUnitCostMinor: cost };
}

export function resultingStock(stock: number, change: StockChange): number {
  const next = stock + (change.kind === 'entry' ? change.quantity : -change.quantity);
  return integer(next, 0, MAX_STOCK, 'Existencia resultante');
}

export function parseBOB(value: string, allowZero = false): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized))
    throw new InventoryInputError('Precio: usa hasta dos decimales, sin separadores de miles.');
  const [whole, fraction = ''] = normalized.split('.');
  return integer(
    Number(whole) * 100 + Number(fraction.padEnd(2, '0')),
    allowZero ? 0 : 1,
    MAX_PRICE_MINOR,
    'Importe en centavos',
  );
}

export function formatBOB(value: number): string {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(value / 100);
}

export function stockStatus(product: Pick<Product, 'stock' | 'minimumStock'>): string {
  if (product.stock === 0) return 'Agotado';
  return product.stock < product.minimumStock ? 'Stock bajo' : 'Disponible';
}
