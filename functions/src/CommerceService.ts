import { expired, validateSpecification } from '../../shared/product-specification.js';
import type { ProductSpecification } from '../../shared/product-specification.js';
import { FieldValue } from 'firebase-admin/firestore';
import { configurationActivity } from '../../shared/business-configuration.js';
import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import {
  allocateDiscount,
  canonical,
  costOf,
  DomainError,
  id,
  int,
  today,
} from '../../shared/commerce.js';
import type { Command, StoredSaleLine } from '../../shared/commerce.js';

export class CommerceService {
  constructor(private readonly db: Firestore) {}
  private ref(uid: string, collection: string, recordId: string): DocumentReference {
    return this.db.doc(`businesses/${id(uid)}/${collection}/${id(recordId)}`);
  }
  private cash(
    tx: Transaction,
    uid: string,
    operationId: string,
    amountMinor: number,
    date: string,
    method: string,
    source: string,
  ) {
    tx.create(this.ref(uid, 'cashEvents', operationId), {
      amountMinor,
      date,
      method,
      source,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  private movement(
    tx: Transaction,
    uid: string,
    operationId: string,
    index: number,
    productId: string,
    before: DocumentData,
    stock: number,
    value: number,
    kind: string,
  ) {
    const movementId = `${operationId}-${index}`;
    tx.update(this.ref(uid, 'products', productId), {
      stock,
      inventoryValueMinor: value,
      lastMovementId: movementId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(this.ref(uid, 'inventoryMovements', movementId), {
      productId,
      kind,
      delta: stock - before.stock,
      stockBefore: before.stock,
      stockAfter: stock,
      valueBeforeMinor: before.inventoryValueMinor,
      valueAfterMinor: value,
      unitCostMinor: null,
      purchaseId: null,
      initialProduct: null,
      reason: kind === 'sale' ? 'Venta' : 'Anulación de venta',
      authorUid: uid,
      saleId: kind === 'sale' ? operationId : before.saleId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  private async customer(
    tx: Transaction,
    uid: string,
    customerId: string,
    customerName: string,
  ): Promise<string> {
    if (!customerId) return customerName;
    const record = await tx.get(this.ref(uid, 'customers', customerId));
    if (!record.exists || record.data()?.active !== true)
      throw new DomainError('Selecciona un cliente activo.');
    return String(record.data()!.name);
  }
  async execute(uid: string, command: Command): Promise<{ id: string }> {
    const signature = canonical(command),
      opRef = this.ref(uid, 'operations', command.operationId);
    return this.db.runTransaction(async (tx) => {
      const businessRef = this.db.doc(`businesses/${id(uid)}`);
      const [business, operation] = await tx.getAll(businessRef, opRef);
      if (!business?.exists || business.data()?.ownerUid !== uid)
        throw new DomainError('Primero crea tu negocio.');
      if (operation?.exists) {
        if (operation.data()?.signature !== signature)
          throw new DomainError('El identificador pertenece a otra solicitud.');
        return operation.data()!.result as { id: string };
      }
      let resultId = command.operationId;
      switch (command.kind) {
        case 'sale':
          await this.sale(tx, uid, command);
          break;
        case 'cancel-sale':
          await this.cancelSale(tx, uid, command);
          resultId = command.input.id;
          break;
        case 'expense': {
          tx.create(this.ref(uid, 'expenses', command.operationId), {
            ...command.input,
            status: 'active',
            authorUid: uid,
            createdAt: FieldValue.serverTimestamp(),
          });
          this.cash(
            tx,
            uid,
            command.operationId,
            -command.input.amountMinor,
            command.input.date,
            command.input.method,
            'expense',
          );
          break;
        }
        case 'cancel-expense': {
          const ref = this.ref(uid, 'expenses', command.input.id),
            snapshot = await tx.get(ref),
            record = snapshot.data();
          if (!record || record.status !== 'active')
            throw new DomainError('El gasto no existe o ya está anulado.');
          tx.update(ref, {
            status: 'cancelled',
            reason: command.input.reason,
            cancelledAt: FieldValue.serverTimestamp(),
          });
          this.cash(
            tx,
            uid,
            command.operationId,
            int(record.amountMinor, 1),
            today(),
            String(record.method),
            'expense-reversal',
          );
          resultId = command.input.id;
          break;
        }
        case 'receivable': {
          const customerName = await this.customer(
            tx,
            uid,
            command.input.customerId,
            command.input.customerName,
          );
          tx.create(this.ref(uid, 'receivables', command.operationId), {
            ...command.input,
            customerName,
            status: 'pending',
            origin: 'manual',
            authorUid: uid,
            createdAt: FieldValue.serverTimestamp(),
          });
          break;
        }
        case 'collect':
          await this.collect(tx, uid, command);
          resultId = command.input.id;
          break;
        case 'cancel-receivable':
          await this.cancelDebt(tx, uid, command);
          resultId = command.input.id;
          break;
        case 'customer':
        case 'service': {
          resultId = command.input.id || command.operationId;
          const ref = this.ref(
              uid,
              command.kind === 'customer' ? 'customers' : 'services',
              resultId,
            ),
            previous = await tx.get(ref);
          if (command.input.id && !previous.exists)
            throw new DomainError('No se encontró el registro para editar.');
          const { id: ignored, ...data } = command.input;
          void ignored;
          tx.set(ref, {
            ...data,
            authorUid: uid,
            createdAt: previous.data()?.createdAt ?? FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          break;
        }
        case 'configure-business': {
          if ((business.data()?.configurationRevision ?? 0) !== command.input.expectedRevision)
            throw new DomainError(
              'La configuración cambió en otra sesión. Actualiza el perfil antes de guardar.',
            );
          const configuration = command.input.configuration;
          tx.update(businessRef, {
            configuration,
            configurationRevision: command.input.expectedRevision + 1,
            activity: configurationActivity(configuration),
            updatedAt: FieldValue.serverTimestamp(),
          });
          resultId = uid;
          break;
        }
        case 'business-settings':
          if (business.data()?.configuration)
            throw new DomainError('Usa la selección de perfil y herramientas de Mi negocio.');
          tx.update(businessRef, { ...command.input, updatedAt: FieldValue.serverTimestamp() });
          resultId = uid;
          break;
      }
      const result = { id: resultId };
      tx.create(opRef, {
        signature,
        kind: command.kind,
        result,
        authorUid: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return result;
    });
  }
  private async sale(tx: Transaction, uid: string, command: Extract<Command, { kind: 'sale' }>) {
    const { input, operationId } = command;
    const customerName = await this.customer(tx, uid, input.customerId, input.customerName);
    const lines: StoredSaleLine[] = [];
    const stockUpdates: {
      id: string;
      before: DocumentData;
      stock: number;
      value: number;
      index: number;
    }[] = [];
    for (const [index, item] of input.lines.entries()) {
      let price: number, cost: number, name: string;
      let specification: ProductSpecification | undefined;
      if (item.kind === 'custom') {
        price = item.priceMinor;
        cost = int(item.unitCostMinor * item.quantity);
        name = item.name;
      } else {
        const snapshot = await tx.get(
          this.ref(uid, item.kind === 'product' ? 'products' : 'services', item.itemId),
        );
        const data = snapshot.data();
        if (!data || data.active !== true)
          throw new DomainError('Hay un artículo inexistente o archivado. Actualiza el catálogo.');
        price = int(data.priceMinor, 1, 999999999);
        name = String(data.name);
        if (price !== item.expectedPriceMinor)
          throw new DomainError(
            `El precio de ${name} cambió. Actualiza el catálogo y revisa la venta.`,
          );
        if (item.kind === 'product') {
          specification =
            data.specification === undefined
              ? undefined
              : validateSpecification(data.specification);
          if (expired(specification, today()) || expired(specification, input.date))
            throw new DomainError(`El lote de ${name} está vencido. Selecciona otro lote.`);
          if (data.inventoryValueMinor === undefined)
            throw new DomainError(`Registra el costo inicial de ${name}.`);
          cost = costOf(
            int(data.inventoryValueMinor),
            int(data.stock, 1, 1000000, 'Existencias'),
            item.quantity,
          );
          stockUpdates.push({
            id: item.itemId,
            before: data,
            stock: data.stock - item.quantity,
            value: data.inventoryValueMinor - cost,
            index,
          });
        } else cost = int(int(data.unitCostMinor, 0, 999999999) * item.quantity);
      }
      const grossMinor = int(price * item.quantity, 1);
      lines.push({
        ...(specification ? { specification } : {}),
        kind: item.kind,
        itemId: item.kind === 'custom' ? '' : item.itemId,
        name,
        quantity: item.quantity,
        priceMinor: price,
        grossMinor,
        discountMinor: 0,
        totalMinor: grossMinor,
        costMinor: cost,
      });
    }
    const allocated = allocateDiscount(lines, input.discountMinor);
    const totalMinor = int(
      allocated.reduce((sum, line) => sum + line.totalMinor, 0),
      1,
    );
    const costMinor = int(allocated.reduce((sum, line) => sum + line.costMinor, 0));
    for (const update of stockUpdates)
      this.movement(
        tx,
        uid,
        operationId,
        update.index,
        update.id,
        update.before,
        update.stock,
        update.value,
        'sale',
      );
    tx.create(this.ref(uid, 'sales', operationId), {
      date: input.date,
      description: input.description,
      discountMinor: input.discountMinor,
      payment: input.payment,
      customerId: input.customerId,
      customerName,
      lines: allocated,
      totalMinor,
      costMinor,
      status: 'active',
      authorUid: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (input.payment === 'credit')
      tx.create(this.ref(uid, 'receivables', operationId), {
        customerId: input.customerId,
        customerName,
        amountMinor: totalMinor,
        date: input.date,
        description: input.description || 'Venta fiada',
        status: 'pending',
        origin: 'sale',
        saleId: operationId,
        authorUid: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    else this.cash(tx, uid, operationId, totalMinor, input.date, input.payment, 'sale');
  }
  private async collect(
    tx: Transaction,
    uid: string,
    command: Extract<Command, { kind: 'collect' }>,
  ) {
    const ref = this.ref(uid, 'receivables', command.input.id),
      snapshot = await tx.get(ref),
      debt = snapshot.data();
    const paymentRef = this.ref(uid, 'payments', command.input.id),
      previous = await tx.get(paymentRef);
    if (!debt || debt.status !== 'pending' || previous.exists)
      throw new DomainError('El fiado no está pendiente o ya fue cobrado.');
    if (command.input.date < debt.date)
      throw new DomainError('El cobro no puede ser anterior al fiado.');
    const amountMinor = int(debt.amountMinor, 1);
    tx.update(ref, { status: 'paid', paidAt: FieldValue.serverTimestamp() });
    tx.create(paymentRef, {
      amountMinor,
      date: command.input.date,
      method: command.input.method,
      customerName: debt.customerName,
      origin: debt.origin,
      saleId: debt.saleId ?? '',
      createdAt: FieldValue.serverTimestamp(),
    });
    this.cash(
      tx,
      uid,
      command.operationId,
      amountMinor,
      command.input.date,
      command.input.method,
      'collection',
    );
  }
  private async cancelDebt(
    tx: Transaction,
    uid: string,
    command: Extract<Command, { kind: 'cancel-receivable' }>,
  ) {
    const ref = this.ref(uid, 'receivables', command.input.id),
      snapshot = await tx.get(ref),
      debt = snapshot.data();
    if (!debt || debt.status === 'cancelled' || debt.origin !== 'manual')
      throw new DomainError(
        'Anula la venta de origen para corregir ese fiado, o revisa su estado.',
      );
    const payment =
      debt.status === 'paid'
        ? (await tx.get(this.ref(uid, 'payments', command.input.id))).data()
        : null;
    if (debt.status === 'paid' && !payment)
      throw new DomainError('No se encontró el cobro original.');
    tx.update(ref, {
      status: 'cancelled',
      reason: command.input.reason,
      cancelledAt: FieldValue.serverTimestamp(),
    });
    if (payment)
      this.cash(
        tx,
        uid,
        command.operationId,
        -int(payment.amountMinor, 1),
        today(),
        String(payment.method),
        'collection-reversal',
      );
  }
  private async cancelSale(
    tx: Transaction,
    uid: string,
    command: Extract<Command, { kind: 'cancel-sale' }>,
  ) {
    const saleRef = this.ref(uid, 'sales', command.input.id),
      snapshot = await tx.get(saleRef),
      sale = snapshot.data();
    if (!sale || sale.status !== 'active')
      throw new DomainError('La venta no existe o ya está anulada.');
    const lines = sale.lines as StoredSaleLine[];
    const updates: {
      id: string;
      before: DocumentData;
      stock: number;
      value: number;
      index: number;
    }[] = [];
    for (const [index, line] of lines.entries())
      if (line.kind === 'product') {
        const product = (await tx.get(this.ref(uid, 'products', line.itemId))).data();
        if (!product) throw new DomainError('Falta un producto de la venta.');
        updates.push({
          id: line.itemId,
          before: { ...product, saleId: command.input.id },
          stock: int(product.stock + line.quantity, 0, 1000000, 'Existencias después de anular'),
          value: int(product.inventoryValueMinor + line.costMinor),
          index,
        });
      }
    const debtRef = this.ref(uid, 'receivables', command.input.id);
    const debt = sale.payment === 'credit' ? (await tx.get(debtRef)).data() : null;
    const payment =
      debt?.status === 'paid'
        ? (await tx.get(this.ref(uid, 'payments', command.input.id))).data()
        : null;
    if (sale.payment === 'credit' && (!debt || (debt.status === 'paid' && !payment)))
      throw new DomainError('No se encontró el fiado o su cobro original.');
    for (const update of updates)
      this.movement(
        tx,
        uid,
        command.operationId,
        update.index,
        update.id,
        update.before,
        update.stock,
        update.value,
        'sale-reversal',
      );
    tx.update(saleRef, {
      status: 'cancelled',
      reason: command.input.reason,
      cancelledAt: FieldValue.serverTimestamp(),
    });
    if (debt)
      tx.update(debtRef, {
        status: 'cancelled',
        reason: command.input.reason,
        cancelledAt: FieldValue.serverTimestamp(),
      });
    if (sale.payment !== 'credit' || payment)
      this.cash(
        tx,
        uid,
        command.operationId,
        -int(sale.totalMinor, 1),
        today(),
        String(payment?.method ?? sale.payment),
        'sale-reversal',
      );
  }
}
