import { today } from '../../../shared/commerce';
import type { DateFilter } from '../../../shared/commerce';
export const paymentNames = {
  cash: 'Efectivo',
  qr: 'QR',
  transfer: 'Transferencia',
  credit: 'Fiado',
};
export function currentMonth(): DateFilter {
  const to = today();
  return { from: `${to.slice(0, 7)}-01`, to };
}
