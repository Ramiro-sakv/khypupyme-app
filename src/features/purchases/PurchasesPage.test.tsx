import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import type { AuthService } from '../auth/types';
import type { BusinessRepository } from '../business/domain';
import type { InventoryRepository } from '../inventory/InventoryRepository';
import { InventoryService } from '../inventory/InventoryService';
import type { Product } from '../inventory/domain';
import { readPending } from '../inventory/pendingOperation';
import { PurchaseService } from './PurchaseService';
import type { PurchaseRepository } from './PurchaseRepository';
import { PurchasesPage } from './PurchasesPage';

beforeEach(() => sessionStorage.clear());
const product: Product = { id: 'p1', name: 'Arroz', priceMinor: 1000, minimumStock: 1, stock: 10, inventoryValueMinor: 5000, active: true, lastMovementId: 'p1', createdAt: new Date(), updatedAt: new Date() };
const auth: AuthService = { observe: () => () => {}, register: vi.fn(), login: vi.fn(), logout: vi.fn(), resetPassword: vi.fn() };
function setup(repository: PurchaseRepository) {
  const business = { get: vi.fn().mockResolvedValue({ id: 'A' }) } as unknown as BusinessRepository;
  const inventory = new InventoryService({ list: vi.fn().mockResolvedValue({ items: [product], next: null }) } as unknown as InventoryRepository);
  return render(<MemoryRouter><AuthContext.Provider value={{ service: auth, user: { uid: 'A', email: 'test@example.invalid' }, status: 'ready', error: '' }}>
    <PurchasesPage businessRepository={business} inventory={inventory} service={new PurchaseService(repository)} />
  </AuthContext.Provider></MemoryRouter>);
}

it('requiere confirmación del total y recupera la misma compra después de una respuesta incierta', async () => {
  const create = vi.fn().mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValue({ id: 'saved' });
  const repository = { list: vi.fn().mockResolvedValue({ items: [], next: null }), create } as unknown as PurchaseRepository;
  const view = setup(repository), user = userEvent.setup();
  const button = await screen.findByRole('button', { name: 'Nueva compra' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(screen.getByLabelText('Producto de la compra')).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Producto de la compra'), 'p1');
  await user.type(screen.getByLabelText('Cantidad comprada'), '10');
  await user.type(screen.getByLabelText('Costo unitario de compra (BOB)'), '7');
  await user.click(screen.getByRole('button', { name: 'Revisar compra' }));
  expect(screen.getByRole('region', { name: 'Confirmación de compra' })).toHaveTextContent('70,00');
  expect(create).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirmar compra' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se confirmó');
  const pending = readPending('A');
  expect(pending?.kind).toBe('purchase');
  expect(screen.getByRole('button', { name: 'Nueva compra' })).toBeDisabled();
  view.unmount(); setup(repository);
  await screen.findByRole('heading', { name: 'Confirma la operación pendiente' });
  expect(create).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Consultar y reintentar' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  await waitFor(() => expect(readPending('A')).toBeNull());
  expect(await screen.findByText('Compra confirmada correctamente.')).toBeVisible();
});
