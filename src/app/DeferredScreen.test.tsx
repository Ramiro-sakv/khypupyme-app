import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { lazy } from 'react';
import { expect, it, vi } from 'vitest';
import { DeferredScreen } from './DeferredScreen';
it('muestra carga y ofrece recuperación si falla un módulo, sin afirmar que se descargó', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let reject!: (cause: Error) => void;
  const Broken = lazy(
    () =>
      new Promise<{ default: () => null }>((_, fail) => {
        reject = fail;
      }),
  );
  render(
    <MemoryRouter>
      <DeferredScreen>
        <Broken />
      </DeferredScreen>
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo herramienta');
  reject(new Error('Chunk no disponible'));
  expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent('conservan su identificador');
  log.mockRestore();
});
