import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ToolGate } from './ToolGate';
import { pendingRequestsChanged } from '../shared/pendingRequests';
vi.mock('../features/auth/auth-context', () => ({ useAuth: () => ({ user: { uid: 'A' } }) }));
const businessState = vi.hoisted(() => ({
  status: 'ready',
  error: '',
  refresh: vi.fn(),
  business: { configuration: { profileId: 'services', version: 1, tools: ['services'] } },
}));
vi.mock('../features/business/business-context', () => ({ useBusiness: () => businessState }));
beforeEach(() => {
  sessionStorage.clear();
  businessState.status = 'ready';
  businessState.error = '';
  businessState.refresh.mockClear();
});
it('permite recuperar inventario pendiente aunque otra sesión haya desactivado la herramienta', () => {
  sessionStorage.setItem('khypupyme:pending-inventory:A', '{"id":"original"}');
  render(
    <MemoryRouter>
      <ToolGate tool="inventory">
        <p>Recuperación disponible</p>
      </ToolGate>
    </MemoryRouter>,
  );
  expect(screen.getByText('Recuperación disponible')).toBeVisible();
  act(() => {
    sessionStorage.removeItem('khypupyme:pending-inventory:A');
    pendingRequestsChanged();
  });
  expect(screen.getByRole('heading')).toHaveTextContent('Esta herramienta está desactivada');
});
it('no utiliza solicitudes de otra cuenta para abrir una herramienta desactivada', () => {
  sessionStorage.setItem('khypupyme:pending-inventory:B', '{"id":"original"}');
  render(
    <MemoryRouter>
      <ToolGate tool="inventory">
        <p>Herramienta abierta</p>
      </ToolGate>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading')).toHaveTextContent('Esta herramienta está desactivada');
  expect(screen.queryByText('Herramienta abierta')).not.toBeInTheDocument();
});

it('no abre ni descarga la herramienta cuando falla la consulta del perfil y permite recuperarla', () => {
  businessState.status = 'error';
  businessState.error = 'Consulta no confirmada';
  render(
    <MemoryRouter>
      <ToolGate tool="inventory">
        <p>Herramienta abierta</p>
      </ToolGate>
    </MemoryRouter>,
  );
  expect(screen.queryByText('Herramienta abierta')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Consulta no confirmada');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }));
  expect(businessState.refresh).toHaveBeenCalledOnce();
});
