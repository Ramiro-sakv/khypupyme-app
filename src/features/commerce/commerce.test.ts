import { describe, expect, it } from 'vitest';
import { allocateDiscount, canonical, costOf, period } from '../../../shared/commerce';
import type { StoredSaleLine } from '../../../shared/commerce';
import { validateCommand } from '../../../functions/src/validation';
import { csvCell } from './export';

const line = (grossMinor: number): StoredSaleLine => ({
  kind: 'custom',
  itemId: '',
  name: 'Trabajo',
  quantity: 1,
  priceMinor: grossMinor,
  grossMinor,
  discountMinor: 0,
  totalMinor: grossMinor,
  costMinor: 0,
});
describe('dinero y solicitudes comerciales', () => {
  it('calcula costo proporcional exacto, mitades arriba y agotamiento', () => {
    expect(costOf(1, 2, 1)).toBe(1);
    expect(costOf(12000, 20, 5)).toBe(3000);
    expect(costOf(1000000000000, 1000000, 1000000)).toBe(1000000000000);
    expect(() => costOf(50, 1, 2)).toThrow();
  });
  it('reparte centavos de descuento sin pérdidas ni importes negativos', () => {
    for (let discount = 0; discount <= 17; discount++) {
      const result = allocateDiscount([line(3), line(7), line(7)], discount);
      expect(result.reduce((sum, row) => sum + row.discountMinor, 0)).toBe(discount);
      expect(result.every((row) => row.totalMinor >= 0)).toBe(true);
    }
    expect(() => allocateDiscount([line(1)], 2)).toThrow();
  });
  it('compara solicitudes independientemente del orden de las claves', () =>
    expect(canonical({ b: [1, 2], a: true })).toBe(canonical({ a: true, b: [1, 2] })));
  it('limita periodos y rechaza fechas inexistentes', () => {
    expect(period({ from: '2026-01-01', to: '2026-12-31' })).toBeTruthy();
    expect(() => period({ from: '2026-02-30', to: '2026-03-01' })).toThrow();
    expect(() => period({ from: '2025-01-01', to: '2026-12-31' })).toThrow();
  });
  it.each(['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '  =1', '\t=1'])(
    'protege fórmulas de CSV: %s',
    (value) => expect(csvCell(value)).toMatch(/^"'/),
  );
  it('escapa comillas y conserva texto normal', () =>
    expect(csvCell('Juan "Pepe"')).toBe('"Juan ""Pepe"""'));
  const expense = {
    kind: 'expense',
    operationId: 'prueba-1',
    input: {
      amountMinor: 100,
      date: '2026-01-01',
      category: 'Otros',
      description: 'Transporte',
      method: 'cash',
    },
  };
  it('rechaza campos y autor del cliente', () => {
    expect(validateCommand(expense)).toMatchObject(expense);
    expect(() => validateCommand({ ...expense, uid: 'otra-cuenta' })).toThrow();
    expect(() =>
      validateCommand({ ...expense, input: { ...expense.input, authorUid: 'otro' } }),
    ).toThrow();
  });
  it.each([0, -1, 1.1, Number.MAX_SAFE_INTEGER, Number.NaN])(
    'rechaza importes inválidos %s',
    (amountMinor) =>
      expect(() =>
        validateCommand({ ...expense, input: { ...expense.input, amountMinor } }),
      ).toThrow(),
  );
  it('rechaza rutas y fechas futuras', () => {
    expect(() => validateCommand({ ...expense, operationId: '../../x' })).toThrow();
    expect(() =>
      validateCommand({ ...expense, input: { ...expense.input, date: '2099-01-01' } }),
    ).toThrow();
  });
});
