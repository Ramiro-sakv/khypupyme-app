import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './InventoryService';
import type { InventoryRepository } from './InventoryRepository';
import { integer, MAX_PRICE_MINOR, MAX_STOCK, parseBOB, productDetails, resultingStock, stockChange, stockStatus } from './domain';

describe('inventario: modelo y validaciones', () => {
  it.each([['0,01', 1], ['12.30', 1230], ['12,3', 1230], ['9999999.99', MAX_PRICE_MINOR], [' 1 ', 100]])('convierte %s sin aritmética decimal monetaria', (text, expected) => {
    expect(parseBOB(text)).toBe(expected);
  });
  it.each(['0', '-1', '1.001', '1e3', '1.000,00', 'NaN', '10000000', ''])('rechaza precio ambiguo o fuera de rango: %s', (value) => {
    expect(() => parseBOB(value)).toThrow();
  });
  it('normaliza nombres y motivos y valida límites', () => {
    expect(productDetails({ name: '  Arroz  ', priceMinor: 1, minimumStock: MAX_STOCK }).name).toBe('Arroz');
    expect(stockChange({ kind: 'entry', quantity: 1, reason: '  Compra  ' }).reason).toBe('Compra');
    expect(() => productDetails({ name: 'a\nb', priceMinor: 10, minimumStock: 0 })).toThrow();
    expect(() => stockChange({ kind: 'exit', quantity: 0, reason: 'Compra' })).toThrow();
    expect(() => stockChange({ kind: 'exit', quantity: 1, reason: '  ' })).toThrow();
    expect(() => integer(1.5, 0, MAX_STOCK, 'Cantidad')).toThrow();
    expect(() => integer(Number.NaN, 0, MAX_STOCK, 'Cantidad')).toThrow();
    expect(() => productDetails({ name: 'Arroz', priceMinor: MAX_PRICE_MINOR + 1, minimumStock: 0 })).toThrow();
  });
  it('impide salidas excesivas y desbordamiento de existencias', () => {
    expect(resultingStock(2, { kind: 'exit', quantity: 2, reason: 'Rotura' })).toBe(0);
    expect(() => resultingStock(1, { kind: 'exit', quantity: 2, reason: 'Rotura' })).toThrow();
    expect(() => resultingStock(MAX_STOCK, { kind: 'entry', quantity: 1, reason: 'Compra' })).toThrow();
  });
  it('distingue agotado, stock bajo y el límite exacto del mínimo', () => {
    expect(stockStatus({ stock: 0, minimumStock: 0 })).toBe('Agotado');
    expect(stockStatus({ stock: 1, minimumStock: 2 })).toBe('Stock bajo');
    expect(stockStatus({ stock: 2, minimumStock: 2 })).toBe('Disponible');
  });
  it('el servicio valida antes de llamar al adaptador', () => {
    const create = vi.fn();
    const service = new InventoryService({ create } as unknown as InventoryRepository);
    expect(() => service.create('A', 'op', { name: 'Arroz', priceMinor: 100, minimumStock: 0, stock: -1 })).toThrow();
    expect(create).not.toHaveBeenCalled();
    service.create('A', 'op', { name: ' Arroz ', priceMinor: 100, minimumStock: 0, stock: 1 });
    expect(create).toHaveBeenCalledWith('A', 'op', { name: 'Arroz', priceMinor: 100, minimumStock: 0, stock: 1 });
  });
});
