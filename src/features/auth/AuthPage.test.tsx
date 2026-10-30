import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { AuthContext } from './auth-context';
import type { AuthService } from './types';
import { AuthPage } from './AuthPage';

function setup(mode: 'login' | 'reset', rejection?: object) {
  const service: AuthService = { observe: () => () => {}, register: vi.fn(), login: rejection ? vi.fn().mockRejectedValue(rejection) : vi.fn().mockResolvedValue(undefined), logout: vi.fn(), resetPassword: vi.fn().mockResolvedValue(undefined) };
  render(<MemoryRouter><AuthContext.Provider value={{ service, user: null, status: 'ready', error: '' }}><AuthPage mode={mode} /></AuthContext.Provider></MemoryRouter>);
  return service;
}
it('presenta un error comprensible al rechazar el acceso', async () => {
  const service = setup('login', { code: 'auth/invalid-credential' });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), 'prueba@example.invalid');
  await user.type(screen.getByLabelText('Contraseña'), 'una-frase-segura');
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(service.login).toHaveBeenCalledOnce();
  expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu correo y contraseña');
});
it('confirma la solicitud local de recuperación sin mostrar un resultado de envío real', async () => {
  const service = setup('reset');
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), 'prueba@example.invalid');
  await user.click(screen.getByRole('button', { name: 'Solicitar recuperación' }));
  expect(service.resetPassword).toHaveBeenCalledWith('prueba@example.invalid');
  expect(await screen.findByRole('status')).toHaveTextContent('terminal del emulador');
});
