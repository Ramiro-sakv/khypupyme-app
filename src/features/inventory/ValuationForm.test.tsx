import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ValuationForm } from './ValuationForm';
import type { Product } from './domain';

it('pide confirmación de una valoración inicial explícita y distingue cero de un costo faltante', async () => {
  const onSave = vi.fn();
  const product: Product = { id: 'legacy', name: 'Producto anterior', stock: 10, inventoryValueMinor: null, priceMinor: 1000, minimumStock: 1, active: true, lastMovementId: 'old', createdAt: new Date(), updatedAt: new Date() };
  render(<ValuationForm product={product} disabled={false} onSave={onSave} onCancel={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Costo unitario de las existencias (BOB)'), '5');
  await user.click(screen.getByRole('button', { name: 'Revisar valoración' }));
  expect(screen.getByText(/Valor inicial:/)).toHaveTextContent('50,00');
  expect(onSave).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Corregir costo' }));
  await user.type(screen.getByLabelText('Costo unitario de las existencias (BOB)'), '0');
  await user.click(screen.getByRole('button', { name: 'Revisar valoración' }));
  await user.click(screen.getByRole('button', { name: 'Confirmar costo inicial' }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(0);
});
