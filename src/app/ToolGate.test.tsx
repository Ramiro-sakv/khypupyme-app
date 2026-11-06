import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ToolGate } from './ToolGate';
import { pendingRequestsChanged } from '../shared/pendingRequests';
vi.mock('../features/auth/auth-context', () => ({ useAuth: () => ({ user: { uid: 'A' } }) }));
vi.mock('../features/business/business-context', () => ({
  useBusiness: () => ({
    status: 'ready',
    business: { configuration: { profileId: 'services', version: 1, tools: ['services'] } },
  }),
}));
beforeEach(() => sessionStorage.clear());
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
