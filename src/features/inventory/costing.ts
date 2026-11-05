import { integer, InventoryInputError, MAX_PRICE_MINOR, MAX_STOCK } from './domain';

export const MAX_INVENTORY_VALUE_MINOR = 1_000_000_000_000;

export function inventoryValue(value: number): number {
  return integer(value, 0, MAX_INVENTORY_VALUE_MINOR, 'Valor del inventario en centavos');
}

export function entryValue(quantity: number, unitCostMinor: number): number {
  integer(quantity, 0, MAX_STOCK, 'Cantidad');
  integer(unitCostMinor, 0, MAX_PRICE_MINOR, 'Costo unitario en centavos');
  return inventoryValue(Number(BigInt(quantity) * BigInt(unitCostMinor)));
}

export function exitValue(valueMinor: number, stock: number, quantity: number): number {
  inventoryValue(valueMinor);
  integer(stock, 1, MAX_STOCK, 'Existencia');
  integer(quantity, 1, stock, 'Cantidad de salida');
  // Redondeo exacto al centavo, mitades hacia arriba. Al agotar, se retira todo el valor.
  const numerator = BigInt(valueMinor) * BigInt(quantity);
  return Number((2n * numerator + BigInt(stock)) / (2n * BigInt(stock)));
}

export function requireValued(value: number | null): number {
  if (value === null) throw new InventoryInputError('Registra el costo inicial antes de comprar o mover este producto.');
  return inventoryValue(value);
}
