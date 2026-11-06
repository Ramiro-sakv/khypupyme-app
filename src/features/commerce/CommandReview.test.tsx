import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { specifications } from '../../../tests/fixtures/product-specifications';
import { CommandReview } from './CommandReview';
it('identifica variante y unidad antes de confirmar sin enviar una operación', () => {
  const confirm = vi.fn();
  render(
    <CommandReview
      command={{
        kind: 'sale',
        operationId: 'op1',
        input: {
          lines: [{ kind: 'product', itemId: 'p1', quantity: 2, expectedPriceMinor: 1000 }],
          date: '2026-11-06',
          discountMinor: 0,
          payment: 'cash',
          customerId: '',
          customerName: '',
          description: '',
        },
      }}
      salePreview={[{ name: 'Zapato de prueba', specification: specifications.apparel }]}
      onConfirm={confirm}
      onBack={vi.fn()}
      busy={false}
    />,
  );
  expect(screen.getByRole('region', { name: 'Confirmar operación' })).toHaveTextContent('2 pares');
  expect(screen.getByRole('region', { name: 'Confirmar operación' })).toHaveTextContent(
    'Zapato de prueba',
  );
  expect(screen.getByRole('region', { name: 'Confirmar operación' })).toHaveTextContent(
    'Talla: 38',
  );
  expect(screen.getByRole('region', { name: 'Confirmar operación' })).toHaveTextContent(
    'Color: Negro',
  );
  expect(confirm).not.toHaveBeenCalled();
});
