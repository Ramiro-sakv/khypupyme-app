import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BusinessProvider } from './BusinessProvider';
import { useBusiness } from './business-context';
import type { Business, BusinessRepository } from './domain';
const auth = vi.hoisted(() => ({ user: { uid: 'A' } }));
vi.mock('../auth/auth-context', () => ({ useAuth: () => auth }));
beforeEach(() => {
  auth.user = { uid: 'A' };
});
const business = (uid: string): Business => ({
  id: uid,
  ownerUid: uid,
  name: `Negocio ${uid}`,
  currency: 'BOB',
  timeZone: 'America/La_Paz',
  createdAt: new Date(),
  updatedAt: new Date(),
});
it('no expone datos ni respuestas pendientes de A al cambiar a B y reutiliza el perfil entre pantallas', async () => {
  const resolves: Record<string, (value: Business) => void> = {};
  const get = vi.fn(
    (uid: string) =>
      new Promise<Business>((resolve) => {
        resolves[uid] = resolve;
      }),
  );
  const repository: BusinessRepository = { get, create: vi.fn(), rename: vi.fn() };
  function Probe() {
    const state = useBusiness();
    return (
      <p>
        {state.status}:{state.business?.name}
      </p>
    );
  }
  const tree = () => (
    <BusinessProvider repository={repository}>
      <Probe />
    </BusinessProvider>
  );
  const view = render(tree());
  auth.user = { uid: 'B' };
  view.rerender(tree());
  await act(async () => {
    resolves.A!(business('A'));
  });
  expect(screen.queryByText(/Negocio A/)).not.toBeInTheDocument();
  await act(async () => {
    resolves.B!(business('B'));
  });
  expect(screen.getByText('ready:Negocio B')).toBeInTheDocument();
  view.rerender(tree());
  expect(get).toHaveBeenCalledTimes(2);
});

it('ignora un guardado tardío de A si ya está cargado el negocio de B', async () => {
  const repository: BusinessRepository = {
    get: vi.fn(async (uid: string) => business(uid)),
    create: vi.fn(),
    rename: vi.fn(),
  };
  let finishSave!: () => void;
  function Probe() {
    const state = useBusiness();
    return (
      <>
        <p>
          {state.status}:{state.business?.name}
        </p>
        <button
          onClick={() => {
            finishSave = () => state.update(business('A'));
          }}
        >
          Iniciar guardado
        </button>
      </>
    );
  }
  const tree = () => (
    <BusinessProvider repository={repository}>
      <Probe />
    </BusinessProvider>
  );
  const view = render(tree());
  await screen.findByText('ready:Negocio A');
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar guardado' }));
  auth.user = { uid: 'B' };
  view.rerender(tree());
  await screen.findByText('ready:Negocio B');
  act(finishSave);
  expect(screen.getByText('ready:Negocio B')).toBeVisible();
});
