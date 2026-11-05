import { expect, it } from 'vitest';
import { entryValue, exitValue, inventoryValue, MAX_INVENTORY_VALUE_MINOR } from './costing';
import { businessDate, purchaseFilter, purchaseInput } from '../purchases/domain';

it('valora 10 unidades a Bs 5 y otras 10 a Bs 7 y calcula salidas', () => {
  const value = entryValue(10, 500) + entryValue(10, 700);
  expect(value).toBe(12000);
  expect(value / 20).toBe(600);
  expect(exitValue(value, 20, 2)).toBe(1200);
  expect(exitValue(value, 20, 20)).toBe(value);
});
it('redondea mitades hacia arriba y conserva todos los centavos al agotar', () => {
  expect(exitValue(1, 2, 1)).toBe(1);
  expect(exitValue(1, 3, 1)).toBe(0);
  expect(exitValue(2, 3, 1)).toBe(1);
  for (let stock = 1; stock <= 30; stock++) {
    let value = 17, removed = 0;
    for (let remaining = stock; remaining > 0; remaining--) {
      const cost = exitValue(value, remaining, 1); removed += cost; value -= cost;
    }
    expect(value).toBe(0); expect(removed).toBe(17);
  }
});
it('mantiene exactitud en los límites de valoración', () => {
  expect(exitValue(MAX_INVENTORY_VALUE_MINOR, 1_000_000, 999_999)).toBe(999_999_000_000);
  expect(() => inventoryValue(MAX_INVENTORY_VALUE_MINOR + 1)).toThrow();
  expect(() => entryValue(1_000_000, 999_999_999)).toThrow();
  expect(() => exitValue(100, 0, 1)).toThrow();
});
it.each(['2026-02-29', '2026-04-31', '2026-13-01', '1999-12-31', '2100-01-01', 'hola'])('rechaza fecha inválida %s', (value) => {
  expect(() => businessDate(value)).toThrow();
});
it('valida compras y periodos sin alterar sus datos', () => {
  expect(businessDate('2024-02-29')).toBe('2024-02-29');
  expect(() => purchaseFilter({ from: '2026-11-02', to: '2026-11-01' })).toThrow();
  expect(purchaseInput({ productId: 'p1', quantity: 10, unitCostMinor: 700, date: '2026-11-05', reference: ' Recibo 1 ' }).reference).toBe('Recibo 1');
  expect(() => purchaseInput({ productId: 'p1', quantity: 1, unitCostMinor: 0, date: '2026-11-05', reference: '' })).toThrow();
});
