import { formatBOB } from '../inventory/domain';
import type { Report } from '../../../shared/commerce';

// Una celda entre comillas sigue siendo una fórmula para varias hojas de cálculo.
export function csvCell(value: string | number): string {
  const text = String(value),
    safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function reportCsv(report: Report): string {
  const rows: (string | number)[][] = [
    ['KhypuPyme · Informe no fiscal'],
    ['Desde', report.filter.from, 'Hasta', report.filter.to],
    ['Concepto', 'BOB'],
    ['Ventas netas', formatBOB(report.salesMinor)],
    ['Costo vendido', formatBOB(report.costMinor)],
    ['Ganancia bruta', formatBOB(report.grossProfitMinor)],
    ['Gastos', formatBOB(report.expensesMinor)],
    ['Bajas de inventario', formatBOB(report.lossesMinor)],
    ['Resultado operativo estimado', formatBOB(report.operatingResultMinor)],
    ['Fiados pendientes (todos los periodos)', formatBOB(report.pendingMinor)],
    [],
    ['Fecha', 'Ventas BOB', 'Gastos BOB'],
    ...report.days.map((day) => [
      day.date,
      (day.salesMinor / 100).toFixed(2),
      (day.expensesMinor / 100).toFixed(2),
    ]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}
export async function downloadReport(report: Report) {
  const filename = `khypupyme-${report.filter.from}-${report.filter.to}.csv`,
    data = reportCsv(report);
  if (import.meta.env.VITE_RUNTIME_TARGET === 'android') {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    // Caché privada, sin permisos de almacenamiento general ni envío automático.
    const file = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Informe KhypuPyme',
      files: [file.uri],
      dialogTitle: 'Guardar o compartir informe',
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
