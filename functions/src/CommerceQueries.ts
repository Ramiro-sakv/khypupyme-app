import type { ProductSpecification } from '../../shared/product-specification.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { DomainError, id, int, period } from '../../shared/commerce.js';
import type {
  DateFilter,
  FinancialRecord,
  QueryInput,
  RecordPage,
  Report,
  Resource,
  StoredSaleLine,
} from '../../shared/commerce.js';

const resources: Resource[] = ['sales', 'expenses', 'receivables', 'customers', 'services'];
function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
  return value;
}
export class CommerceQueries {
  constructor(private readonly db: Firestore,private readonly transaction?:Transaction) {}
  async owner(uid: string): Promise<void> {
    const ref=this.db.doc(`businesses/${id(uid)}`),business = await (this.transaction?this.transaction.get(ref):ref.get());
    if (!business.exists || business.data()?.ownerUid !== uid)
      throw new DomainError('Primero crea tu negocio.');
  }
  async list(uid: string, input: QueryInput): Promise<RecordPage> {
    await this.owner(uid);
    if (!input || !resources.includes(input.resource)) throw new DomainError('Consulta inválida.');
    const root = this.db.collection(`businesses/${id(uid)}/${input.resource}`);
    if (input.id) {
      const snapshot = await root.doc(id(input.id)).get();
      return {
        items: snapshot.exists
          ? [{ ...(serialize(snapshot.data()) as FinancialRecord), id: snapshot.id }]
          : [],
        next: null,
      };
    }
    const financial = ['sales', 'expenses', 'receivables'].includes(input.resource);
    let query: Query = root;
    if (financial && input.filter) {
      const filter = period(input.filter);
      query = query
        .where('date', '>=', filter.from)
        .where('date', '<=', filter.to)
        .orderBy('date', 'desc');
    }
    query = query.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
    if (input.cursor) {
      const cursor = await root.doc(id(input.cursor)).get();
      if (!cursor.exists) throw new DomainError('La página anterior ya no está disponible.');
      query = query.startAfter(cursor);
    }
    const result = await query.limit(26).get(),
      visible = result.docs.slice(0, 25);
    return {
      items: visible.map((doc) => ({ ...(serialize(doc.data()) as FinancialRecord), id: doc.id })),
      next: result.size > 25 ? visible.at(-1)!.id : null,
    };
  }
  async status(uid: string, operationId: string): Promise<{ id: string } | null> {
    await this.owner(uid);
    const snapshot = await this.db.doc(`businesses/${id(uid)}/operations/${id(operationId)}`).get();
    return snapshot.exists ? (snapshot.data()!.result as { id: string }) : null;
  }
  private async bounded(query: Query): Promise<DocumentData[]> {
    const bounded=query.limit(10001),result = await (this.transaction?this.transaction.get(bounded):bounded.get());
    if (result.size > 10000)
      throw new DomainError('El informe supera 10.000 registros por sección. Reduce el periodo.');
    return result.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  }
  async report(uid: string, rawFilter: DateFilter): Promise<Report> {
    await this.owner(uid);
    const filter = period(rawFilter);
    const collection = (name: string) => this.db.collection(`businesses/${id(uid)}/${name}`);
    const range = (name: string) =>
      collection(name).where('date', '>=', filter.from).where('date', '<=', filter.to);
    // America/La_Paz no tiene cambios de horario en el periodo admitido; medianoche corresponde a 04:00 UTC.
    const from = new Date(`${filter.from}T04:00:00Z`),
      until = new Date(`${filter.to}T04:00:00Z`);
    until.setUTCDate(until.getUTCDate() + 1);
    const [allSales, allExpenses, events, pending, products, losses] = await Promise.all([
      this.bounded(range('sales')),
      this.bounded(range('expenses')),
      this.bounded(range('cashEvents')),
      this.bounded(collection('receivables').where('status', '==', 'pending')),
      this.bounded(collection('products').where('active', '==', true)),
      this.bounded(
        collection('inventoryMovements')
          .where('kind', '==', 'exit')
          .where('createdAt', '>=', Timestamp.fromDate(from))
          .where('createdAt', '<', Timestamp.fromDate(until)),
      ),
    ]);
    const sales = allSales.filter((sale) => sale.status === 'active'),
      expenses = allExpenses.filter((expense) => expense.status === 'active');
    const sum = (records: DocumentData[], field: string) =>
      int(records.reduce((total, record) => total + int(record[field]), 0));
    const salesMinor = sum(sales, 'totalMinor'),
      costMinor = sum(sales, 'costMinor'),
      expensesMinor = sum(expenses, 'amountMinor');
    const valuedLosses = losses.filter(
      (loss) =>
        typeof loss.valueBeforeMinor === 'number' && typeof loss.valueAfterMinor === 'number',
    );
    const lossesMinor = int(
      valuedLosses.reduce(
        (total, loss) => total + int(loss.valueBeforeMinor - loss.valueAfterMinor),
        0,
      ),
    );
    const cashInMinor = int(
      events
        .filter((event) => event.amountMinor > 0)
        .reduce((sum, event) => sum + int(event.amountMinor), 0),
    );
    const cashOutMinor = int(
      events
        .filter((event) => event.amountMinor < 0)
        .reduce((sum, event) => sum + int(-event.amountMinor), 0),
    );
    const buckets = new Map<string, { date: string; salesMinor: number; expensesMinor: number }>();
    for (
      let cursor = Date.parse(filter.from);
      cursor <= Date.parse(filter.to);
      cursor += 86400000
    ) {
      const date = new Date(cursor).toISOString().slice(0, 10);
      buckets.set(date, { date, salesMinor: 0, expensesMinor: 0 });
    }
    const top = new Map<
        string,
        { name: string; quantity: number; totalMinor: number; specification?: ProductSpecification }
      >(),
      categories = new Map<string, number>();
    for (const sale of sales) {
      buckets.get(sale.date)!.salesMinor += sale.totalMinor;
      for (const line of sale.lines as StoredSaleLine[]) {
        const key = `${line.kind}:${line.itemId || line.name}`,
          record = top.get(key) ?? {
            name: line.name,
            quantity: 0,
            totalMinor: 0,
            ...(line.specification ? { specification: line.specification } : {}),
          };
        record.quantity += line.quantity;
        record.totalMinor += line.totalMinor;
        top.set(key, record);
      }
    }
    for (const expense of expenses) {
      buckets.get(expense.date)!.expensesMinor += expense.amountMinor;
      categories.set(
        expense.category,
        (categories.get(expense.category) ?? 0) + expense.amountMinor,
      );
    }
    return {
      filter,
      salesMinor,
      costMinor,
      expensesMinor,
      lossesMinor,
      unvaluedLossCount: losses.length - valuedLosses.length,
      grossProfitMinor: salesMinor - costMinor,
      operatingResultMinor: salesMinor - costMinor - expensesMinor - lossesMinor,
      marginPercent: salesMinor === 0 ? null : ((salesMinor - costMinor) / salesMinor) * 100,
      cashInMinor,
      cashOutMinor,
      cashBalanceMinor: cashInMinor - cashOutMinor,
      pendingMinor: sum(pending, 'amountMinor'),
      saleCount: sales.length,
      days: [...buckets.values()],
      topProducts: [...top.values()].sort((a, b) => b.totalMinor - a.totalMinor).slice(0, 10),
      categories: [...categories].map(([name, totalMinor]) => ({ name, totalMinor })),
      alerts: products
        .filter((product) => product.stock === 0 || product.stock < product.minimumStock)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 20)
        .map((product) => ({
          id: product.id,
          name: product.name,
          stock: product.stock,
          minimumStock: product.minimumStock,
        })),
      generatedAt: new Date().toISOString(),
      inventoryValueMinor: int(
        products.reduce(
          (total, product) =>
            total +
            (typeof product.inventoryValueMinor === 'number'
              ? int(product.inventoryValueMinor)
              : 0),
          0,
        ),
      ),
      pendingValuationCount: products.filter((product) => product.inventoryValueMinor === undefined)
        .length,
    };
  }
}
