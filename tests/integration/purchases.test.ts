import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc, terminate } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { FirebaseAuthService } from '../../src/features/auth/FirebaseAuthService';
import { FirestoreBusinessRepository } from '../../src/features/business/FirestoreBusinessRepository';
import { FirestoreInventoryRepository } from '../../src/features/inventory/FirestoreInventoryRepository';
import { InventoryService } from '../../src/features/inventory/InventoryService';
import { FirestorePurchaseRepository } from '../../src/features/purchases/FirestorePurchaseRepository';
import { PurchaseService } from '../../src/features/purchases/PurchaseService';
import { requireTestEmulators, testAuthUrl, testFirestorePort, testProjectId } from '../emulator-environment';

async function session() {
  requireTestEmulators();
  const id = randomUUID(), app = initializeApp({ projectId: testProjectId, apiKey: 'demo-api-key' }, id);
  const auth = getAuth(app), db = getFirestore(app);
  connectAuthEmulator(auth, testAuthUrl, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', testFirestorePort);
  await new FirebaseAuthService(auth).register(`purchase-${id}@example.invalid`, 'una-frase-de-prueba-segura');
  const uid = auth.currentUser!.uid;
  await new FirestoreBusinessRepository(db).create(uid, 'Negocio compras');
  return { uid, inventory: new InventoryService(new FirestoreInventoryRepository(db)), purchases: new PurchaseService(new FirestorePurchaseRepository(db)), close: async () => { await terminate(db); await deleteApp(app); } };
}
const initial = { name: 'Arroz', priceMinor: 1000, minimumStock: 2, stock: 10, initialUnitCostMinor: 500 };
const input = (productId: string) => ({ productId, quantity: 10, unitCostMinor: 700, date: '2026-11-05', reference: 'Recibo ficticio 1' });
const filter = { from: '2026-01-01', to: '2026-12-31' };

it('compra y valora con historial, mantiene solicitudes originales y retira el costo promedio', async () => {
  const { uid, inventory, purchases, close } = await session();
  try {
    const id = randomUUID(), purchaseId = randomUUID();
    await inventory.create(uid, id, initial);
    const saved = await purchases.create(uid, purchaseId, input(id));
    expect(saved.totalMinor).toBe(7000);
    expect(saved.createdAt.getTime()).toBeGreaterThan(0);
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 20, inventoryValueMinor: 12000 });
    await inventory.move(uid, id, randomUUID(), { kind: 'exit', quantity: 2, reason: 'Merma documentada' });
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 18, inventoryValueMinor: 10800 });
    await inventory.update(uid, id, { ...initial, name: 'Nuevo nombre' });
    expect((await purchases.create(uid, purchaseId, input(id))).productName).toBe('Arroz');
    await expect(purchases.create(uid, purchaseId, { ...input(id), reference: 'Otra referencia' })).rejects.toThrow('otra operación');
    await expect(purchases.create(uid, purchaseId, { ...input(id), date: '2026-11-04' })).rejects.toThrow('otra operación');
    expect((await purchases.list(uid, filter)).items).toHaveLength(1);
    expect((await inventory.history(uid, id)).items.map((item) => item.valueAfterMinor)).toEqual([10800, 12000, 5000]);
  } finally { await close(); }
});

it('anula solo sin movimientos posteriores, conserva compra e idempotencia', async () => {
  const { uid, inventory, purchases, close } = await session();
  try {
    const id = randomUUID(), purchaseId = randomUUID(), reversalId = randomUUID();
    await inventory.create(uid, id, initial);
    await purchases.create(uid, purchaseId, input(id));
    await purchases.reverse(uid, purchaseId, reversalId, 'Registro equivocado');
    await purchases.reverse(uid, purchaseId, reversalId, 'Registro equivocado');
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 10, inventoryValueMinor: 5000 });
    expect(await purchases.isReversed(uid, purchaseId)).toBe(true);
    await purchases.create(uid, purchaseId, input(id));
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 10, inventoryValueMinor: 5000 });
    expect((await purchases.list(uid, filter)).items).toHaveLength(1);
    await expect(purchases.reverse(uid, purchaseId, randomUUID(), 'Segundo intento')).rejects.toThrow('ya está anulada');
    const next = randomUUID();
    await purchases.create(uid, next, input(id));
    await inventory.move(uid, id, randomUUID(), { kind: 'entry', unitCostMinor: 0, quantity: 1, reason: 'Obsequio del proveedor' });
    await expect(purchases.reverse(uid, next, randomUUID(), 'No debe revertir')).rejects.toThrow('movimientos posteriores');
  } finally { await close(); }
});

it('compras concurrentes distintas se acumulan y una solicitud duplicada se aplica una vez', async () => {
  const { uid, inventory, purchases, close } = await session();
  try {
    const id = randomUUID();
    await inventory.create(uid, id, initial);
    await Promise.all([1, 2].map(() => purchases.create(uid, randomUUID(), input(id))));
    const sameId = randomUUID();
    await Promise.all([1, 2].map(() => purchases.create(uid, sameId, input(id))));
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 40, inventoryValueMinor: 26000 });
    expect((await purchases.list(uid, filter)).items).toHaveLength(3);
  } finally { await close(); }
});

it('una carrera con el mismo ID y distintas referencias no confirma dos solicitudes diferentes', async () => {
  const { uid, inventory, purchases, close } = await session();
  try {
    const id = randomUUID(), operation = randomUUID();
    await inventory.create(uid, id, initial);
    const results = await Promise.allSettled(['A', 'B'].map((reference) => purchases.create(uid, operation, { ...input(id), reference })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 20, inventoryValueMinor: 12000 });
  } finally { await close(); }
});

it('conserva productos antiguos y exige valoración explícita sin inventar compras', async () => {
  const { uid, inventory, purchases, close } = await session();
  const env = await initializeTestEnvironment({ projectId: testProjectId, firestore: { host: '127.0.0.1', port: testFirestorePort } });
  try {
    const id = randomUUID();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', uid, 'products', id), {
        name: 'Producto anterior', priceMinor: 1000, minimumStock: 2, stock: 10, active: true,
        lastMovementId: 'apertura-antigua', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await setDoc(doc(context.firestore(), 'businesses', uid, 'inventoryMovements', 'apertura-antigua'), {
        productId: id, kind: 'opening', delta: 10, stockBefore: 0, stockAfter: 10,
        reason: 'Stock inicial', authorUid: uid, createdAt: serverTimestamp(),
        initialProduct: { name: 'Producto anterior', priceMinor: 1000, minimumStock: 2 },
      });
    });
    expect((await inventory.get(uid, id))?.inventoryValueMinor).toBeNull();
    expect((await inventory.history(uid, id)).items[0]?.valueAfterMinor).toBeNull();
    await expect(purchases.create(uid, randomUUID(), input(id))).rejects.toThrow('costo inicial');
    await expect(inventory.move(uid, id, randomUUID(), { kind: 'exit', quantity: 1, reason: 'Salida de prueba' })).rejects.toThrow('costo inicial');
    const operation = randomUUID();
    await inventory.initializeCost(uid, id, operation, 500);
    await inventory.initializeCost(uid, id, operation, 500);
    await expect(inventory.initializeCost(uid, id, randomUUID(), 100)).rejects.toThrow('costo pendiente');
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 10, inventoryValueMinor: 5000 });
    expect((await purchases.list(uid, filter)).items).toHaveLength(0);
    await purchases.create(uid, randomUUID(), input(id));
    expect(await inventory.get(uid, id)).toMatchObject({ stock: 20, inventoryValueMinor: 12000 });
    expect((await inventory.history(uid, id)).items).toHaveLength(3);
  } finally { await env.cleanup(); await close(); }
});

it('pagina y filtra por fecha y producto sin duplicar compras', async () => {
  const { uid, inventory, purchases, close } = await session();
  try {
    const firstId = randomUUID(), otherId = randomUUID();
    await inventory.create(uid, firstId, { ...initial, stock: 0 });
    await inventory.create(uid, otherId, { ...initial, stock: 0 });
    // Secuencial: cada compra modifica el mismo producto, no se fuerza contención artificial masiva.
    for (let i = 0; i < 27; i++) await purchases.create(uid, randomUUID(), { ...input(firstId), quantity: 1, date: i === 0 ? '2026-11-01' : '2026-11-05' });
    await purchases.create(uid, randomUUID(), input(otherId));
    const first = await purchases.list(uid, { ...filter, productId: firstId });
    const second = await purchases.list(uid, { ...filter, productId: firstId }, first.next!);
    expect(first.items).toHaveLength(25); expect(second.items).toHaveLength(2); expect(second.next).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(27);
    expect((await purchases.list(uid, { from: '2026-11-01', to: '2026-11-01', productId: firstId })).items).toHaveLength(1);
    expect((await purchases.list(uid, { ...filter, productId: otherId })).items).toHaveLength(1);
  } finally { await close(); }
}, 60000);
