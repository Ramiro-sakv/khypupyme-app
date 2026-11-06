import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useCommerceCommand } from './useCommerce';
import { CommerceService } from './CommerceRepository';
import type { Command } from '../../../shared/commerce';
const command: Command = {
  kind: 'expense',
  operationId: 'operation-1',
  input: {
    amountMinor: 100,
    date: '2026-01-01',
    category: 'Otros',
    description: 'Prueba',
    method: 'cash',
  },
};
const execute = vi.fn(),
  status = vi.fn();
const service = new CommerceService({ execute, status, list: vi.fn(), report: vi.fn() });
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
});
it('conserva solicitud original ante respuesta incierta, consulta y confirma sin reenviar', async () => {
  execute.mockRejectedValue(new Error('red'));
  status.mockResolvedValue({ id: command.operationId });
  const done = vi.fn(),
    { result } = renderHook(() => useCommerceCommand('A', service, done));
  await act(() => result.current.execute(command));
  expect(result.current.pending).toEqual(command);
  expect(JSON.parse(sessionStorage.getItem('khypupyme:pending-commerce:A')!)).toEqual(command);
  await act(() =>
    result.current.execute({ ...command, input: { ...command.input, amountMinor: 200 } }),
  );
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.current.pending).toEqual(command);
  await act(() => result.current.consult());
  expect(execute).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenCalledWith(command.operationId, command);
  expect(sessionStorage.length).toBe(0);
});
it('reintenta manualmente con el mismo ID y bloquea operaciones cruzadas', async () => {
  execute
    .mockRejectedValueOnce(new Error('red'))
    .mockResolvedValueOnce({ id: command.operationId });
  const done = vi.fn(),
    { result } = renderHook(() => useCommerceCommand('A', service, done));
  sessionStorage.setItem('khypupyme:pending-inventory:A', '{}');
  await act(() => result.current.execute(command));
  expect(execute).not.toHaveBeenCalled();
  sessionStorage.removeItem('khypupyme:pending-inventory:A');
  await act(() => result.current.execute(command));
  expect(result.current.retryAllowed).toBe(false);
  status.mockResolvedValueOnce(null);
  await act(() => result.current.consult());
  expect(result.current.retryAllowed).toBe(true);
  await act(() => result.current.execute(result.current.pending!));
  expect(execute.mock.calls.map((call) => call[0])).toEqual([command, command]);
  expect(done).toHaveBeenCalledOnce();
});
