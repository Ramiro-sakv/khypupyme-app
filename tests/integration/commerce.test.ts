import { specifications } from '../fixtures/product-specifications';
import { industryConfiguration } from '../../shared/business-configuration';
import { PurchaseService } from '../../src/features/purchases/PurchaseService';
import { FirestorePurchaseRepository } from '../../src/features/purchases/FirestorePurchaseRepository';
import { randomUUID } from 'node:crypto';
import { defaultConfiguration } from '../../shared/business-configuration';
import type { BusinessConfiguration } from '../../shared/business-configuration';
import { expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
  terminate,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseAuthService } from '../../src/features/auth/FirebaseAuthService';
import { FirestoreBusinessRepository } from '../../src/features/business/FirestoreBusinessRepository';
import { InventoryService } from '../../src/features/inventory/InventoryService';
import { FirestoreInventoryRepository } from '../../src/features/inventory/FirestoreInventoryRepository';
import { CommerceService } from '../../src/features/commerce/CommerceRepository';
import { FirebaseCommerceRepository } from '../../src/features/commerce/FirebaseCommerceRepository';
import type { Command, SaleInput } from '../../shared/commerce';
import { today } from '../../shared/commerce';
import {
  requireTestEmulators,
  testAuthUrl,
  testFirestorePort,
  testProjectId,
} from '../emulator-environment';

async function session(configuration?: BusinessConfiguration) {
  requireTestEmulators();
  const app = initializeApp({ projectId: testProjectId, apiKey: 'demo-api-key' }, randomUUID());
  const auth = getAuth(app),
    db = getFirestore(app),
    functions = getFunctions(app);
  connectAuthEmulator(auth, testAuthUrl, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', testFirestorePort);
  connectFunctionsEmulator(functions, '127.0.0.1', 15001);
  await new FirebaseAuthService(auth).register(
    `beta-${randomUUID()}@example.invalid`,
    'una-frase-de-prueba-segura',
  );
  const uid = auth.currentUser!.uid;
  await new FirestoreBusinessRepository(db).create(uid, 'Beta de prueba', configuration);
  const inventory = new InventoryService(new FirestoreInventoryRepository(db)),
    service = new CommerceService(new FirebaseCommerceRepository(functions));
  return {
    uid,
    db,
    functions,
    service,
    inventory,
    close: async () => {
      await terminate(db);
      await deleteApp(app);
    },
  };
}
function sale(
  productId: string,
  quantity = 2,
  payment: SaleInput['payment'] = 'cash',
): Extract<Command, { kind: 'sale' }> {
  return {
    kind: 'sale',
    operationId: randomUUID(),
    input: {
      lines: [{ kind: 'product', itemId: productId, quantity, expectedPriceMinor: 1000 }],
      date: today(),
      discountMinor: 0,
      description: '',
      payment,
      customerId: '',
      customerName: payment === 'credit' ? 'Cliente ficticio' : '',
    },
  };
}
const product = {
  name: 'Arroz beta',
  priceMinor: 1000,
  stock: 10,
  initialUnitCostMinor: 500,
  minimumStock: 2,
};
const filter = () => ({ from: today(), to: today() });
it('venta atómica e idempotente conserva precio y costo históricos y revierte al anular', async () => {
  const s = await session();
  try {
    const id = randomUUID();
    await s.inventory.create(s.uid, id, product);
    const command = sale(id);
    await Promise.all([s.service.execute(command), s.service.execute(command)]);
    expect(await s.inventory.get(s.uid, id)).toMatchObject({ stock: 8, inventoryValueMinor: 4000 });
    expect((await s.service.list('sales')).items).toHaveLength(1);
    expect(await s.service.status(command.operationId)).toEqual({ id: command.operationId });
    expect(await s.service.status(randomUUID())).toBeNull();
    await expect(
      s.service.execute({
        ...command,
        input: { ...command.input, description: 'Otro intento' },
      } as Command),
    ).rejects.toThrow();
    await s.inventory.update(s.uid, id, { ...product, priceMinor: 2000, name: 'Nombre cambiado' });
    const saved = await s.service.get('sales', command.operationId);
    expect(saved?.lines?.[0]).toMatchObject({
      name: 'Arroz beta',
      priceMinor: 1000,
      costMinor: 1000,
      totalMinor: 2000,
    });
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 2000,
      costMinor: 1000,
      grossProfitMinor: 1000,
      cashInMinor: 2000,
      pendingMinor: 0,
    });
    const cancel: Command = {
      kind: 'cancel-sale',
      operationId: randomUUID(),
      input: { id: command.operationId, reason: 'Devolución completa' },
    };
    await s.service.execute(cancel);
    await s.service.execute(cancel);
    expect(await s.inventory.get(s.uid, id)).toMatchObject({
      stock: 10,
      inventoryValueMinor: 5000,
    });
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 0,
      costMinor: 0,
      cashInMinor: 2000,
      cashOutMinor: 2000,
    });
    expect((await s.inventory.history(s.uid, id)).items.map((m) => m.kind)).toEqual([
      'sale-reversal',
      'sale',
      'opening',
    ]);
  } finally {
    await s.close();
  }
}, 60000);
it('dos ventas simultáneas no sobrevendan; las rechazadas no dejan movimientos parciales', async () => {
  const s = await session();
  try {
    const id = randomUUID();
    await s.inventory.create(s.uid, id, { ...product, stock: 3 });
    const results = await Promise.allSettled([
      s.service.execute(sale(id)),
      s.service.execute(sale(id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await s.inventory.get(s.uid, id)).toMatchObject({ stock: 1, inventoryValueMinor: 500 });
    expect((await s.service.list('sales')).items).toHaveLength(1);
    expect((await s.inventory.history(s.uid, id)).items).toHaveLength(2);
  } finally {
    await s.close();
  }
}, 60000);
it('fiado no duplica ventas al cobrar y anular devuelve dinero y existencias', async () => {
  const s = await session();
  try {
    const id = randomUUID();
    await s.inventory.create(s.uid, id, product);
    const command = sale(id, 2, 'credit');
    await s.service.execute(command);
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 2000,
      cashInMinor: 0,
      pendingMinor: 2000,
    });
    const collect: Command = {
      kind: 'collect',
      operationId: randomUUID(),
      input: { id: command.operationId, date: today(), method: 'qr' },
    };
    await Promise.all([s.service.execute(collect), s.service.execute(collect)]);
    await expect(s.service.execute({ ...collect, operationId: randomUUID() })).rejects.toThrow();
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 2000,
      cashInMinor: 2000,
      pendingMinor: 0,
    });
    await s.service.execute({
      kind: 'cancel-sale',
      operationId: randomUUID(),
      input: { id: command.operationId, reason: 'Venta equivocada' },
    });
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 0,
      cashInMinor: 2000,
      cashOutMinor: 2000,
      pendingMinor: 0,
    });
    expect(await s.inventory.get(s.uid, id)).toMatchObject({ stock: 10 });
  } finally {
    await s.close();
  }
}, 60000);
it('servicios, descuentos, gastos y deuda anterior producen informes separados del cobro', async () => {
  const s = await session();
  try {
    const catalog: Command = {
      kind: 'service',
      operationId: randomUUID(),
      input: { id: '', name: 'Reparación', priceMinor: 1000, unitCostMinor: 300, active: true },
    };
    await s.service.execute(catalog);
    await s.service.execute({
      kind: 'sale',
      operationId: randomUUID(),
      input: {
        lines: [
          { kind: 'service', itemId: catalog.operationId, quantity: 1, expectedPriceMinor: 1000 },
          { kind: 'custom', name: 'Entrega', quantity: 1, priceMinor: 500, unitCostMinor: 100 },
        ],
        date: today(),
        discountMinor: 100,
        description: '',
        payment: 'transfer',
        customerId: '',
        customerName: '',
      },
    });
    const expense: Command = {
      kind: 'expense',
      operationId: randomUUID(),
      input: {
        amountMinor: 200,
        date: today(),
        description: 'Pasaje de prueba',
        category: 'Transporte',
        method: 'cash',
      },
    };
    await s.service.execute(expense);
    const debt: Command = {
      kind: 'receivable',
      operationId: randomUUID(),
      input: {
        amountMinor: 700,
        date: today(),
        description: 'Deuda anterior de prueba',
        customerId: '',
        customerName: 'Ana ficticia',
      },
    };
    await s.service.execute(debt);
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 1400,
      costMinor: 400,
      grossProfitMinor: 1000,
      expensesMinor: 200,
      operatingResultMinor: 800,
      pendingMinor: 700,
      cashInMinor: 1400,
      cashOutMinor: 200,
    });
    await s.service.execute({
      kind: 'collect',
      operationId: randomUUID(),
      input: { id: debt.operationId, date: today(), method: 'cash' },
    });
    expect(await s.service.report(filter())).toMatchObject({ salesMinor: 1400, cashInMinor: 2100 });
    await s.service.execute({
      kind: 'cancel-receivable',
      operationId: randomUUID(),
      input: { id: debt.operationId, reason: 'Deuda duplicada' },
    });
    await s.service.execute({
      kind: 'cancel-expense',
      operationId: randomUUID(),
      input: { id: expense.operationId, reason: 'Gasto duplicado' },
    });
    expect(await s.service.report(filter())).toMatchObject({
      salesMinor: 1400,
      expensesMinor: 0,
      cashInMinor: 2300,
      cashOutMinor: 900,
      operatingResultMinor: 1000,
    });
  } finally {
    await s.close();
  }
}, 60000);
it('rechaza manipulación de autor, precios, costos, cantidades y acceso entre cuentas', async () => {
  const a = await session(),
    b = await session();
  try {
    const id = randomUUID();
    await a.inventory.create(a.uid, id, product);
    const command = sale(id);
    await expect(b.service.execute(command)).rejects.toThrow();
    await expect(
      httpsCallable(a.functions, 'commerceCommand')({ ...command, uid: b.uid }),
    ).rejects.toThrow();
    await expect(
      httpsCallable(
        a.functions,
        'commerceCommand',
      )({ ...command, input: { ...command.input, costMinor: 0 } }),
    ).rejects.toThrow();
    await expect(
      a.service.execute({
        ...command,
        input: {
          ...command.input,
          lines: [{ kind: 'product', itemId: id, quantity: 1, expectedPriceMinor: 1 }],
        },
      } as Command),
    ).rejects.toThrow();
    for (const resource of [
      'sales',
      'expenses',
      'receivables',
      'payments',
      'customers',
      'services',
      'cashEvents',
      'operations',
    ]) {
      await expect(
        setDoc(doc(a.db, `businesses/${a.uid}/${resource}/malicious`), {
          amountMinor: 1,
          authorUid: a.uid,
        }),
      ).rejects.toThrow();
      await expect(
        getDocFromServer(doc(b.db, `businesses/${a.uid}/${resource}/malicious`)),
      ).rejects.toThrow();
    }
    const app = initializeApp({ projectId: testProjectId, apiKey: 'demo-api-key' }, randomUUID()),
      fn = getFunctions(app);
    connectFunctionsEmulator(fn, '127.0.0.1', 15001);
    await expect(httpsCallable(fn, 'commerceCommand')(command)).rejects.toThrow();
    await deleteApp(app);
    expect(await a.inventory.get(a.uid, id)).toMatchObject({ stock: 10 });
  } finally {
    await a.close();
    await b.close();
  }
}, 60000);
it('clientes, servicios archivados, actividad y paginación conservan datos', async () => {
  const s = await session();
  try {
    // Es preparación de paginación, no una prueba de carga: evita abrir 26
    // procesos de Functions en equipos de 8 GB. Las carreras se prueban arriba.
    for (let i = 0; i < 26; i++)
      await s.service.execute({
        kind: 'customer',
        operationId: randomUUID(),
        input: { id: '', name: `Cliente ficticio ${i}`, phone: '', notes: '', active: true },
      });
    const first = await s.service.list('customers');
    expect(first.items).toHaveLength(25);
    expect(first.next).toBeTruthy();
    const next = await s.service.list('customers', undefined, first.next!);
    expect(next.items).toHaveLength(1);
    expect(first.items.some((item) => item.id === next.items[0]!.id)).toBe(false);
    const customer = first.items[0]!;
    await s.service.execute({
      kind: 'customer',
      operationId: randomUUID(),
      input: {
        id: customer.id,
        name: customer.name!,
        phone: '',
        notes: 'Archivado',
        active: false,
      },
    });
    expect(await s.service.get('customers', customer.id)).toMatchObject({
      active: false,
      notes: 'Archivado',
    });
    await s.service.execute({
      kind: 'business-settings',
      operationId: randomUUID(),
      input: { activity: 'mixed' },
    });
    expect((await getDocFromServer(doc(s.db, 'businesses', s.uid))).data()?.activity).toBe('mixed');
  } finally {
    await s.close();
  }
}, 60000);

it('crea perfil atómico y conserva stock, costos e historial al cambiar herramientas', async () => {
  const s = await session(defaultConfiguration('retail'));
  try {
    const repository = new FirestoreBusinessRepository(s.db);
    expect(await repository.get(s.uid)).toMatchObject({
      configuration: defaultConfiguration('retail'),
      configurationRevision: 1,
    });
    const id = randomUUID();
    await s.inventory.create(s.uid, id, product);
    const before = await s.inventory.get(s.uid, id),
      history = await s.inventory.history(s.uid, id);
    const command: Command = {
      kind: 'configure-business',
      operationId: randomUUID(),
      input: { configuration: defaultConfiguration('services'), expectedRevision: 1 },
    };
    await s.service.execute(command);
    await s.service.execute(command);
    expect(await repository.get(s.uid)).toMatchObject({
      configuration: defaultConfiguration('services'),
      configurationRevision: 2,
      activity: 'services',
    });
    expect(await s.inventory.get(s.uid, id)).toEqual(before);
    expect(await s.inventory.history(s.uid, id)).toEqual(history);
    await expect(s.service.execute({ ...command, operationId: randomUUID() })).rejects.toThrow(
      'cambió',
    );
    await expect(
      s.service.execute({
        kind: 'business-settings',
        operationId: randomUUID(),
        input: { activity: 'mixed' },
      }),
    ).rejects.toThrow();
    expect((await s.service.report(filter())).inventoryValueMinor).toBe(5000);
  } finally {
    await s.close();
  }
}, 60000);
it('migra perfil anterior explícitamente, rechaza versiones falsas y resuelve dos configuraciones concurrentes', async () => {
  const a = await session(),
    b = await session();
  try {
    const commands: Command[] = ['retail', 'services'].map((profile) => ({
      kind: 'configure-business',
      operationId: randomUUID(),
      input: {
        configuration: defaultConfiguration(profile as 'retail' | 'services'),
        expectedRevision: 0,
      },
    }));
    const results = await Promise.allSettled(commands.map((command) => a.service.execute(command)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await new FirestoreBusinessRepository(a.db).get(a.uid))?.configurationRevision).toBe(1);
    expect((await new FirestoreBusinessRepository(b.db).get(b.uid))?.configuration).toBeUndefined();
    for (const configuration of [
      { ...defaultConfiguration('retail'), version: 99 },
      { ...defaultConfiguration('retail'), tools: ['purchases'] },
      { ...defaultConfiguration('retail'), profileId: 'manufacturing' },
    ]) {
      await expect(
        httpsCallable(
          a.functions,
          'commerceCommand',
        )({
          kind: 'configure-business',
          operationId: randomUUID(),
          input: { configuration, expectedRevision: 1 },
        }),
      ).rejects.toThrow();
    }
    await expect(
      setDoc(
        doc(b.db, 'businesses', a.uid),
        { configuration: defaultConfiguration('mixed') },
        { merge: true },
      ),
    ).rejects.toThrow();
    expect((await new FirestoreBusinessRepository(a.db).get(a.uid))?.configurationRevision).toBe(1);
  } finally {
    await a.close();
    await b.close();
  }
}, 60000);

it.each(Object.values(specifications))(
  'compra, vende y conserva la ficha $kind al cambiar el rubro',
  async (specification) => {
    const s = await session(industryConfiguration('timber'));
    try {
      const id = randomUUID(),
        input = { ...product, specification };
      await s.inventory.create(s.uid, id, input);
      await s.inventory.create(s.uid, id, input);
      await expect(
        s.inventory.create(s.uid, id, {
          ...input,
          specification: specifications[specification.kind === 'general' ? 'timber' : 'general'],
        }),
      ).rejects.toThrow('otra operación');
      const purchases = new PurchaseService(new FirestorePurchaseRepository(s.db)),
        purchaseId = randomUUID();
      const request = {
        productId: id,
        quantity: 2,
        unitCostMinor: 500,
        date: today(),
        reference: 'Lote original',
      };
      const bought = await purchases.create(s.uid, purchaseId, request);
      await purchases.create(s.uid, purchaseId, request);
      expect(bought.specification).toEqual(specification);
      expect(await s.inventory.get(s.uid, id)).toMatchObject({
        stock: 12,
        inventoryValueMinor: 6000,
        specification,
      });
      const command = sale(id, 2);
      await s.service.execute(command);
      const receipt = await s.service.get('sales', command.operationId);
      expect(receipt?.lines?.[0]).toMatchObject({ quantity: 2, costMinor: 1000, specification });
      expect((await s.service.report(filter())).topProducts[0]).toMatchObject({
        quantity: 2,
        specification,
      });
      await s.service.execute({
        kind: 'configure-business',
        operationId: randomUUID(),
        input: { configuration: industryConfiguration('professional'), expectedRevision: 1 },
      });
      expect(await s.inventory.get(s.uid, id)).toMatchObject({
        stock: 10,
        inventoryValueMinor: 5000,
        specification,
      });
      expect(
        (await s.service.get('sales', command.operationId))?.lines?.[0]?.specification,
      ).toEqual(specification);
      await s.service.execute({
        kind: 'cancel-sale',
        operationId: randomUUID(),
        input: { id: command.operationId, reason: 'Prueba de corrección' },
      });
      expect(await s.inventory.get(s.uid, id)).toMatchObject({
        stock: 12,
        inventoryValueMinor: 6000,
        specification,
      });
    } finally {
      await s.close();
    }
  },
);
it.each(['perishable', 'cement'] as const)(
  'rechaza venta de %s vencido aun con fecha pasada y cliente malicioso',
  async (kind) => {
    const s = await session();
    try {
      const id = randomUUID();
      await s.inventory.create(s.uid, id, {
        ...product,
        specification: {
          ...specifications[kind],
          attributes: { ...specifications[kind].attributes, expiresOn: '2001-01-01' },
        },
      });
      const command = sale(id);
      await expect(s.service.execute(command)).rejects.toThrow('vencido');
      await expect(
        s.service.execute({ ...command, input: { ...command.input, date: '2000-12-31' } }),
      ).rejects.toThrow('vencido');
      expect(await s.service.status(command.operationId)).toBeNull();
      expect(await s.inventory.get(s.uid, id)).toMatchObject({
        stock: 10,
        inventoryValueMinor: 5000,
      });
      expect((await s.service.list('sales')).items).toHaveLength(0);
    } finally {
      await s.close();
    }
  },
);
