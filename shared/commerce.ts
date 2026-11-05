export const MAX_AMOUNT = 1_000_000_000_000;
export type PaymentMethod = 'cash' | 'qr' | 'transfer';
export type SaleLineInput =
  | { kind: 'product' | 'service'; itemId: string; quantity: number; expectedPriceMinor: number }
  | { kind: 'custom'; name: string; quantity: number; priceMinor: number; unitCostMinor: number };
export interface SaleInput {
  lines: SaleLineInput[];
  date: string;
  description: string;
  discountMinor: number;
  payment: PaymentMethod | 'credit';
  customerId: string;
  customerName: string;
}
export interface StoredSaleLine {
  kind: 'product' | 'service' | 'custom';
  itemId: string;
  name: string;
  quantity: number;
  priceMinor: number;
  grossMinor: number;
  discountMinor: number;
  totalMinor: number;
  costMinor: number;
}
export type Command = { operationId: string } & (
  | { kind: 'sale'; input: SaleInput }
  | { kind: 'cancel-sale'; input: { id: string; reason: string } }
  | {
      kind: 'expense';
      input: {
        amountMinor: number;
        category: string;
        date: string;
        description: string;
        method: PaymentMethod;
      };
    }
  | { kind: 'cancel-expense'; input: { id: string; reason: string } }
  | {
      kind: 'receivable';
      input: {
        amountMinor: number;
        date: string;
        customerId: string;
        customerName: string;
        description: string;
      };
    }
  | { kind: 'collect'; input: { id: string; date: string; method: PaymentMethod } }
  | { kind: 'cancel-receivable'; input: { id: string; reason: string } }
  | {
      kind: 'customer';
      input: { id: string; name: string; phone: string; notes: string; active: boolean };
    }
  | {
      kind: 'service';
      input: {
        id: string;
        name: string;
        priceMinor: number;
        unitCostMinor: number;
        active: boolean;
      };
    }
  | { kind: 'business-settings'; input: { activity: 'commerce' | 'services' | 'mixed' } }
);
export type Resource = 'sales' | 'expenses' | 'receivables' | 'customers' | 'services';
export interface DateFilter {
  from: string;
  to: string;
}
export interface QueryInput {
  resource: Resource;
  filter?: DateFilter;
  cursor?: string;
  id?: string;
}
export interface FinancialRecord {
  id: string;
  name?: string;
  phone?: string;
  notes?: string;
  active?: boolean;
  priceMinor?: number;
  unitCostMinor?: number;
  date?: string;
  description?: string;
  category?: string;
  totalMinor?: number;
  amountMinor?: number;
  costMinor?: number;
  discountMinor?: number;
  status?: string;
  customerName?: string;
  customerId?: string;
  payment?: string;
  origin?: string;
  saleId?: string;
  lines?: StoredSaleLine[];
  createdAt?: string;
  cancelledAt?: string;
  reason?: string;
}
export interface RecordPage {
  items: FinancialRecord[];
  next: string | null;
}
export interface Report {
  filter: DateFilter;
  salesMinor: number;
  costMinor: number;
  expensesMinor: number;
  grossProfitMinor: number;
  operatingResultMinor: number;
  marginPercent: number | null;
  cashInMinor: number;
  cashOutMinor: number;
  cashBalanceMinor: number;
  pendingMinor: number;
  saleCount: number;
  days: { date: string; salesMinor: number; expensesMinor: number }[];
  topProducts: { name: string; quantity: number; totalMinor: number }[];
  categories: { name: string; totalMinor: number }[];
  alerts: { id: string; name: string; stock: number; minimumStock: number }[];
  generatedAt: string;
  lossesMinor: number;
  unvaluedLossCount: number;
  inventoryValueMinor: number;
  pendingValuationCount: number;
}

export class DomainError extends Error {}
export function int(value: unknown, min = 0, max = MAX_AMOUNT, label = 'Importe'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new DomainError(`${label}: valor fuera de rango.`);
  return value;
}
export function text(value: unknown, min: number, max: number, label = 'Texto'): string {
  if (typeof value !== 'string') throw new DomainError(`${label}: dato inválido.`);
  const result = value.trim();
  if (result.length < min || result.length > max || /[\r\n]/.test(result))
    throw new DomainError(`${label}: usa entre ${min} y ${max} caracteres en una línea.`);
  return result;
}
export function id(value: unknown): string {
  const result = text(value, 1, 128, 'Identificador');
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new DomainError('Identificador inválido.');
  return result;
}
export function date(value: unknown): string {
  const result = text(value, 10, 10, 'Fecha'),
    parsed = new Date(`${result}T00:00:00Z`);
  if (
    !/^20\d\d-\d\d-\d\d$/.test(result) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  )
    throw new DomainError('Fecha inválida.');
  return result;
}
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function period(value: DateFilter): DateFilter {
  const from = date(value.from),
    to = date(value.to);
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 365)
    throw new DomainError('Elige un periodo de hasta 366 días, con fechas en orden.');
  return { from, to };
}
export function costOf(value: number, stock: number, quantity: number): number {
  int(value);
  int(stock, 1, 1_000_000, 'Existencias');
  int(quantity, 1, stock, 'Cantidad');
  return Number((2n * BigInt(value) * BigInt(quantity) + BigInt(stock)) / (2n * BigInt(stock)));
}
export function allocateDiscount(lines: StoredSaleLine[], discount: number): StoredSaleLine[] {
  const gross = int(
    lines.reduce((sum, line) => sum + line.grossMinor, 0),
    1,
  );
  int(discount, 0, gross, 'Descuento');
  let remaining = discount;
  // Reparto secuencial proporcional: evita restos y nunca supera el importe de una línea.
  let remainingGross = gross;
  return lines.map((line, index) => {
    const share =
      index === lines.length - 1
        ? remaining
        : Number((BigInt(remaining) * BigInt(line.grossMinor)) / BigInt(remainingGross));
    remaining -= share;
    remainingGross -= line.grossMinor;
    return { ...line, discountMinor: share, totalMinor: line.grossMinor - share };
  });
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
