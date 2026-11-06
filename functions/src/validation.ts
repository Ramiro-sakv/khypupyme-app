import { date, DomainError, id, int, period, text, today } from '../../shared/commerce.js';
import type { Command, PaymentMethod, SaleLineInput } from '../../shared/commerce.js';
import { validateConfiguration } from '../../shared/business-configuration.js';

function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new DomainError('Solicitud inválida.');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !fields.includes(key)) ||
    fields.some((key) => !(key in record))
  )
    throw new DomainError('La solicitud contiene campos incorrectos.');
  return record;
}
function payment(value: unknown): PaymentMethod {
  if (!['cash', 'qr', 'transfer'].includes(String(value)))
    throw new DomainError('Método de pago inválido.');
  return value as PaymentMethod;
}
function pastDate(value: unknown) {
  const result = date(value);
  if (result > today()) throw new DomainError('La fecha no puede estar en el futuro.');
  return result;
}
function optionalId(value: unknown): string {
  return value === '' ? '' : id(value);
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new DomainError('Estado inválido.');
  return value;
}
export function validateCommand(raw: unknown): Command {
  const command = object(raw, ['operationId', 'kind', 'input']);
  const operationId = id(text(command.operationId, 1, 80, 'Operación')),
    kind = command.kind;
  switch (kind) {
    case 'sale': {
      const data = object(command.input, [
        'lines',
        'date',
        'description',
        'discountMinor',
        'payment',
        'customerId',
        'customerName',
      ]);
      if (!Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 30)
        throw new DomainError('La venta admite entre 1 y 30 líneas.');
      const seen = new Set<string>();
      const lines: SaleLineInput[] = data.lines.map((rawLine: unknown) => {
        if (rawLine === null || typeof rawLine !== 'object')
          throw new DomainError('Línea inválida.');
        const lineKind = (rawLine as Record<string, unknown>).kind;
        if (lineKind === 'custom') {
          const line = object(rawLine, ['kind', 'name', 'quantity', 'priceMinor', 'unitCostMinor']);
          return {
            kind: 'custom',
            name: text(line.name, 2, 80, 'Descripción'),
            quantity: int(line.quantity, 1, 1000000, 'Cantidad'),
            priceMinor: int(line.priceMinor, 1, 999999999),
            unitCostMinor: int(line.unitCostMinor, 0, 999999999),
          };
        }
        const line = object(rawLine, ['kind', 'itemId', 'quantity', 'expectedPriceMinor']);
        if (lineKind !== 'product' && lineKind !== 'service')
          throw new DomainError('Tipo de línea inválido.');
        const itemId = id(line.itemId),
          key = `${lineKind}:${itemId}`;
        if (seen.has(key))
          throw new DomainError('Agrupa las cantidades de un mismo artículo en una línea.');
        seen.add(key);
        return {
          kind: lineKind,
          itemId,
          quantity: int(line.quantity, 1, 1000000, 'Cantidad'),
          expectedPriceMinor: int(line.expectedPriceMinor, 1, 999999999),
        };
      });
      const method = data.payment === 'credit' ? 'credit' : payment(data.payment);
      return {
        kind,
        operationId,
        input: {
          lines,
          date: pastDate(data.date),
          description: text(data.description, 0, 200),
          discountMinor: int(data.discountMinor),
          payment: method,
          customerId: optionalId(data.customerId),
          customerName: text(
            data.customerName,
            method === 'credit' && data.customerId === '' ? 2 : 0,
            80,
            'Cliente',
          ),
        },
      };
    }
    case 'expense': {
      const data = object(command.input, [
        'amountMinor',
        'category',
        'date',
        'description',
        'method',
      ]);
      return {
        kind,
        operationId,
        input: {
          amountMinor: int(data.amountMinor, 1),
          category: text(data.category, 2, 60, 'Categoría'),
          date: pastDate(data.date),
          description: text(data.description, 2, 200, 'Descripción'),
          method: payment(data.method),
        },
      };
    }
    case 'receivable': {
      const data = object(command.input, [
        'amountMinor',
        'date',
        'customerId',
        'customerName',
        'description',
      ]);
      return {
        kind,
        operationId,
        input: {
          amountMinor: int(data.amountMinor, 1),
          date: pastDate(data.date),
          customerId: optionalId(data.customerId),
          customerName: text(data.customerName, data.customerId === '' ? 2 : 0, 80, 'Cliente'),
          description: text(data.description, 2, 200, 'Descripción'),
        },
      };
    }
    case 'collect': {
      const data = object(command.input, ['id', 'date', 'method']);
      return {
        kind,
        operationId,
        input: { id: id(data.id), date: pastDate(data.date), method: payment(data.method) },
      };
    }
    case 'cancel-sale':
    case 'cancel-expense':
    case 'cancel-receivable': {
      const data = object(command.input, ['id', 'reason']);
      return {
        kind,
        operationId,
        input: { id: id(data.id), reason: text(data.reason, 3, 200, 'Motivo') },
      };
    }
    case 'customer': {
      const data = object(command.input, ['id', 'name', 'phone', 'notes', 'active']);
      return {
        kind,
        operationId,
        input: {
          id: optionalId(data.id),
          name: text(data.name, 2, 80, 'Nombre'),
          phone: text(data.phone, 0, 30, 'Teléfono'),
          notes: text(data.notes, 0, 200, 'Notas'),
          active: boolean(data.active),
        },
      };
    }
    case 'service': {
      const data = object(command.input, ['id', 'name', 'priceMinor', 'unitCostMinor', 'active']);
      return {
        kind,
        operationId,
        input: {
          id: optionalId(data.id),
          name: text(data.name, 2, 80, 'Nombre'),
          priceMinor: int(data.priceMinor, 1, 999999999),
          unitCostMinor: int(data.unitCostMinor, 0, 999999999),
          active: boolean(data.active),
        },
      };
    }
    case 'configure-business': {
      const data = object(command.input, ['configuration', 'expectedRevision']);
      return {
        kind,
        operationId,
        input: {
          configuration: validateConfiguration(data.configuration),
          expectedRevision: int(data.expectedRevision, 0, 999999, 'Revisión'),
        },
      };
    }
    case 'business-settings': {
      const data = object(command.input, ['activity']);
      if (!['commerce', 'services', 'mixed'].includes(String(data.activity)))
        throw new DomainError('Actividad inválida.');
      return {
        kind,
        operationId,
        input: { activity: data.activity as 'commerce' | 'services' | 'mixed' },
      };
    }
    default:
      throw new DomainError('Operación no reconocida.');
  }
}
export { period };
