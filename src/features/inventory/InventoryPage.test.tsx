import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import type { AuthService } from '../auth/types';
import type { BusinessRepository } from '../business/domain';
import type { InventoryRepository } from './InventoryRepository';
import { InventoryService } from './InventoryService';
import { InventoryPage } from './InventoryPage';
import { readPending } from './pendingOperation';

beforeEach(() => sessionStorage.clear());
const auth: AuthService = { observe: () => () => {}, register: vi.fn(), login: vi.fn(), logout: vi.fn(), resetPassword: vi.fn() };
function setup(repository: InventoryRepository) {
  const businessRepository = { get: vi.fn().mockResolvedValue({ id: 'A' }) } as unknown as BusinessRepository;
  return render(<MemoryRouter><AuthContext.Provider value={{ service: auth, user: { uid: 'A', email: 'test@example.invalid' }, status: 'ready', error: '' }}>
    <InventoryPage businessRepository={businessRepository} service={new InventoryService(repository)} />
  </AuthContext.Provider></MemoryRouter>);
}

it('conserva solicitud y ID tras respuesta incierta y recarga, sin reenvío automático', async () => {
  const create = vi.fn().mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValue({ id: 'confirmed' });
  const repository = { list: vi.fn().mockResolvedValue({ items: [], next: null }), create } as unknown as InventoryRepository;
  const view = setup(repository);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
  await user.type(screen.getByLabelText('Nombre del producto'), 'Arroz');
  await user.type(screen.getByLabelText('Precio de venta (BOB)'), '12,50');
  await user.click(screen.getByRole('button', { name: 'Crear producto' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se confirmó');
  const saved = readPending('A');
  expect(saved?.kind).toBe('create');
  expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled();
  view.unmount();
  setup(repository);
  await screen.findByRole('heading', { name: 'Confirma la operación pendiente' });
  expect(create).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Consultar y reintentar' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[1]?.[1]).toBe(saved?.id);
  await waitFor(() => expect(readPending('A')).toBeNull());
  expect(await screen.findByText('Producto creado correctamente.')).toHaveAttribute('role', 'status');
});

it('bloquea operaciones cuando el registro pendiente está dañado', async () => {
  sessionStorage.setItem('khypupyme:pending-inventory:A', '{');
  const create = vi.fn();
  setup({ list: vi.fn().mockResolvedValue({ items: [], next: null }), create } as unknown as InventoryRepository);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer la operación pendiente');
  expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled();
  expect(create).not.toHaveBeenCalled();
});
