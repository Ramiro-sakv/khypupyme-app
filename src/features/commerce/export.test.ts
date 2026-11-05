import { afterEach, expect, it, vi } from 'vitest';
import type { Report } from '../../../shared/commerce';
import { downloadReport } from './export';
const { writeFile, share } = vi.hoisted(() => ({ writeFile: vi.fn(), share: vi.fn() }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share } }));
const report: Report = {
  filter: { from: '2026-11-01', to: '2026-11-05' },
  salesMinor: 10000,
  costMinor: 2000,
  expensesMinor: 1000,
  lossesMinor: 0,
  unvaluedLossCount: 0,
  inventoryValueMinor: 0,
  pendingValuationCount: 0,
  grossProfitMinor: 8000,
  operatingResultMinor: 7000,
  marginPercent: 80,
  cashInMinor: 10000,
  cashOutMinor: 1000,
  cashBalanceMinor: 9000,
  pendingMinor: 0,
  saleCount: 1,
  days: [],
  topProducts: [],
  categories: [],
  alerts: [],
  generatedAt: '2026-11-05T12:00:00Z',
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it('Android prepara CSV en caché privada y abre la selección de destino del usuario', async () => {
  vi.stubEnv('VITE_RUNTIME_TARGET', 'android');
  writeFile.mockResolvedValue({ uri: 'file:///cache/report.csv' });
  share.mockResolvedValue({});
  await downloadReport(report);
  expect(writeFile).toHaveBeenCalledWith(
    expect.objectContaining({
      directory: 'CACHE',
      encoding: 'utf8',
      path: 'khypupyme-2026-11-01-2026-11-05.csv',
      data: expect.stringContaining('Resultado operativo estimado'),
    }),
  );
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({ files: ['file:///cache/report.csv'] }),
  );
});
it('no declara exportación cuando falla la escritura y no comparte un archivo inexistente', async () => {
  vi.stubEnv('VITE_RUNTIME_TARGET', 'android');
  writeFile.mockRejectedValue(new Error('No disponible'));
  await expect(downloadReport(report)).rejects.toThrow('No disponible');
  expect(share).not.toHaveBeenCalled();
});
