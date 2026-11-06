import type { ProductSpecification } from '../../../shared/product-specification';
export interface SalePreviewLine {
  name: string;
  specification?: ProductSpecification;
}
import { today } from '../../../shared/commerce';
import type { Command, DateFilter } from '../../../shared/commerce';
export const commandNames: Record<Command['kind'], string> = {
  sale: 'Venta',
  'cancel-sale': 'Anulación de venta',
  expense: 'Gasto',
  'cancel-expense': 'Anulación de gasto',
  receivable: 'Fiado anterior',
  collect: 'Cobro',
  'cancel-receivable': 'Anulación de fiado',
  customer: 'Cliente',
  service: 'Servicio',
  'business-settings': 'Actividad del negocio',
  'configure-business': 'Perfil y herramientas',
};
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
