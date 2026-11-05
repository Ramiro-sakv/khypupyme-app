import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { requireTestEmulators, testFirestorePort, testProjectId } from '../emulator-environment';

type DB = ReturnType<RulesTestContext['firestore']>;
let env: RulesTestEnvironment;
const details = { name: 'Producto ficticio', priceMinor: 1000, minimumStock: 1 };
const product = (db: DB, uid = 'A') => doc(db, 'businesses', uid, 'products', 'p1');
const movement = (db: DB, id = 'buy1', uid = 'A') => doc(db, 'businesses', uid, 'inventoryMovements', id);
const purchase = (db: DB, uid = 'A') => doc(db, 'businesses', uid, 'purchases', 'buy1');
const reversal = (db: DB, uid = 'A') => doc(db, 'businesses', uid, 'purchaseReversals', 'buy1');
const purchaseData = () => ({ productId: 'p1', productName: details.name, quantity: 10, unitCostMinor: 700, totalMinor: 7000, date: '2026-11-05', reference: 'Prueba', stockBefore: 10, stockAfter: 20, valueBeforeMinor: 5000, valueAfterMinor: 12000, authorUid: 'A', createdAt: serverTimestamp() });
const movementData = () => ({ productId: 'p1', kind: 'purchase', delta: 10, stockBefore: 10, stockAfter: 20, valueBeforeMinor: 5000, valueAfterMinor: 12000, unitCostMinor: 700, purchaseId: 'buy1', reason: 'Compra', authorUid: 'A', initialProduct: null, createdAt: serverTimestamp() });
const productChange = () => ({ stock: 20, inventoryValueMinor: 12000, lastMovementId: 'buy1', updatedAt: serverTimestamp() });

beforeAll(async () => {
  requireTestEmulators();
  env = await initializeTestEnvironment({ projectId: testProjectId, firestore: { host: '127.0.0.1', port: testFirestorePort, rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of ['A', 'B']) {
      await setDoc(doc(db, 'businesses', uid), { ownerUid: uid });
      await setDoc(product(db, uid), { ...details, stock: 10, inventoryValueMinor: 5000, active: true, lastMovementId: 'p1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  });
});
afterAll(async () => { await env?.cleanup(); });

function purchaseBatch(db: DB, p: Record<string, unknown> = {}, m: Record<string, unknown> = {}, value: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.update(product(db), { ...productChange(), ...value });
  batch.set(purchase(db), { ...purchaseData(), ...p });
  batch.set(movement(db), { ...movementData(), ...m });
  return batch;
}
function reversalBatch(db: DB, r: Record<string, unknown> = {}, m: Record<string, unknown> = {}, value: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.update(product(db), { stock: 10, inventoryValueMinor: 5000, lastMovementId: 'reverse1', updatedAt: serverTimestamp(), ...value });
  batch.set(reversal(db), { purchaseId: 'buy1', operationId: 'reverse1', reason: 'Corrección', authorUid: 'A', createdAt: serverTimestamp(), ...r });
  batch.set(movement(db, 'reverse1'), { ...movementData(), kind: 'purchase-reversal', delta: -10, stockBefore: 20, stockAfter: 10, valueBeforeMinor: 12000, valueAfterMinor: 5000, unitCostMinor: null, reason: 'Corrección', ...m });
  return batch;
}

it('compra y anula atómicamente; conserva los tres documentos originales', async () => {
  const db = env.authenticatedContext('A').firestore();
  await assertSucceeds(purchaseBatch(db).commit());
  await assertSucceeds(reversalBatch(db).commit());
  expect((await getDoc(product(db))).data()?.inventoryValueMinor).toBe(5000);
  expect((await getDoc(purchase(db))).data()?.totalMinor).toBe(7000);
  await assertFails(updateDoc(purchase(db), { totalMinor: 1 }));
  await assertFails(deleteDoc(purchase(db)));
  await assertFails(deleteDoc(reversal(db)));
  await assertFails(updateDoc(reversal(db), { reason: 'Reescribir' }));
  await assertFails(reversalBatch(db).commit());
});

it('exige compra, movimiento y producto juntos, sin pares parciales', async () => {
  const db = env.authenticatedContext('A').firestore();
  await assertFails(setDoc(purchase(db), purchaseData()));
  await assertFails(setDoc(movement(db), movementData()));
  await assertFails(updateDoc(product(db), productChange()));
  for (const omitted of ['product', 'purchase', 'movement']) {
    const batch = writeBatch(db);
    if (omitted !== 'product') batch.update(product(db), productChange());
    if (omitted !== 'purchase') batch.set(purchase(db), purchaseData());
    if (omitted !== 'movement') batch.set(movement(db), movementData());
    await assertFails(batch.commit());
  }
});

it.each([
  { quantity: 0 }, { quantity: 1.5 }, { unitCostMinor: 0 }, { unitCostMinor: -1 }, { unitCostMinor: 1.25 },
  { totalMinor: 6999 }, { productName: 'Otro nombre' }, { productId: 'otro' }, { authorUid: 'B' },
  { date: '2026-02-29' }, { date: '2026-04-31' }, { date: '2026-13-01' }, { date: '1999-01-01' },
  { reference: 'x'.repeat(101) }, { reference: 'a\nb' }, { createdAt: Timestamp.fromMillis(0) },
  { stockBefore: 9 }, { valueBeforeMinor: 4000 }, { admin: true },
])('rechaza compra manipulada: %j', async (change) => {
  await assertFails(purchaseBatch(env.authenticatedContext('A').firestore(), change).commit());
});

it('rechaza costo falso coherente entre los tres documentos y compras de costo cero', async () => {
  const db = env.authenticatedContext('A').firestore();
  await assertFails(purchaseBatch(db, { totalMinor: 6000, valueAfterMinor: 11000 }, { valueAfterMinor: 11000 }, { inventoryValueMinor: 11000 }).commit());
  await assertFails(purchaseBatch(db, { unitCostMinor: 0, totalMinor: 0, valueAfterMinor: 5000 }, { unitCostMinor: 0, valueAfterMinor: 5000 }, { inventoryValueMinor: 5000 }).commit());
  await assertFails(updateDoc(product(db), { inventoryValueMinor: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(product(db), { ...details, inventoryValueMinor: 1, updatedAt: serverTimestamp() }));
});

it('rechaza límites, compras de archivados y movimientos ajenos a una compra', async () => {
  const db = env.authenticatedContext('A').firestore();
  await assertFails(purchaseBatch(db, { quantity: 1000000, stockAfter: 1000010 }, { delta: 1000000, stockAfter: 1000010 }, { stock: 1000010 }).commit());
  await assertFails(purchaseBatch(db, { valueAfterMinor: 1000000000001 }, { valueAfterMinor: 1000000000001 }, { inventoryValueMinor: 1000000000001 }).commit());
  await updateDoc(product(db), { active: false, updatedAt: serverTimestamp() });
  await assertFails(purchaseBatch(db).commit());
});

it.each([{ authorUid: 'B' }, { purchaseId: 'otra' }, { operationId: 'otro' }, { reason: '  ' }, { createdAt: Timestamp.fromMillis(0) }, { admin: true }])('protege anulación: %j', async (change) => {
  const db = env.authenticatedContext('A').firestore();
  await purchaseBatch(db).commit();
  await assertFails(reversalBatch(db, change).commit());
});

it('no anula una compra con movimientos posteriores, incluso falseando el estado previo', async () => {
  const db = env.authenticatedContext('A').firestore();
  await purchaseBatch(db).commit();
  const batch = writeBatch(db);
  batch.update(product(db), { stock: 21, inventoryValueMinor: 12000, lastMovementId: 'next', updatedAt: serverTimestamp() });
  batch.set(movement(db, 'next'), { ...movementData(), kind: 'entry', delta: 1, stockBefore: 20, stockAfter: 21, valueBeforeMinor: 12000, valueAfterMinor: 12000, unitCostMinor: 0, purchaseId: null, reason: 'Obsequio' });
  await assertSucceeds(batch.commit());
  await assertFails(reversalBatch(db).commit());
  await assertFails(reversalBatch(db, {}, { stockBefore: 21, stockAfter: 11 }, { stock: 11 }).commit());
});

it('no admite dos movimientos acreditados por una sola compra', async () => {
  const db = env.authenticatedContext('A').firestore();
  const batch = purchaseBatch(db);
  batch.set(movement(db, 'extra'), movementData());
  await assertFails(batch.commit());
});

it('requiere valoración inicial explícita y la permite una sola vez', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(product(context.firestore()), { ...details, stock: 10, active: true, lastMovementId: 'p1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  const db = env.authenticatedContext('A').firestore();
  await assertFails(purchaseBatch(db).commit());
  await assertFails(updateDoc(product(db), { inventoryValueMinor: 5000, updatedAt: serverTimestamp() }));
  const batch = writeBatch(db);
  batch.update(product(db), { inventoryValueMinor: 5000, lastMovementId: 'value1', updatedAt: serverTimestamp() });
  batch.set(movement(db, 'value1'), { ...movementData(), kind: 'valuation', delta: 0, stockBefore: 10, stockAfter: 10, valueBeforeMinor: null, valueAfterMinor: 5000, unitCostMinor: 500, purchaseId: null, reason: 'Valoración inicial' });
  await assertSucceeds(batch.commit());
  const second = writeBatch(db);
  second.update(product(db), { inventoryValueMinor: 1000, lastMovementId: 'value2', updatedAt: serverTimestamp() });
  second.set(movement(db, 'value2'), { ...movementData(), kind: 'valuation', delta: 0, stockBefore: 10, stockAfter: 10, valueBeforeMinor: 5000, valueAfterMinor: 1000, unitCostMinor: 100, purchaseId: null, reason: 'Valoración inicial' });
  await assertFails(second.commit());
});

it.each([
  { stock: 2, value: 1, quantity: 1, expected: 1 },
  { stock: 3, value: 1, quantity: 1, expected: 0 },
  { stock: 3, value: 2, quantity: 3, expected: 2 },
  { stock: 1000000, value: 999999999999, quantity: 333333, expected: 333333000000 },
])('verifica redondeo exacto, incluidas mitades y extremos: %j', async ({ stock, value, quantity, expected }) => {
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(product(context.firestore()), { stock, inventoryValueMinor: value });
  });
  const db = env.authenticatedContext('A').firestore();
  for (const removed of [expected - 1, expected + 1, expected]) {
    const batch = writeBatch(db);
    batch.update(product(db), { stock: stock - quantity, inventoryValueMinor: value - removed, lastMovementId: 'exit1', updatedAt: serverTimestamp() });
    batch.set(movement(db, 'exit1'), { ...movementData(), kind: 'exit', delta: -quantity, stockBefore: stock, stockAfter: stock - quantity, valueBeforeMinor: value, valueAfterMinor: value - removed, unitCostMinor: null, purchaseId: null, reason: 'Merma' });
    if (removed === expected) await assertSucceeds(batch.commit()); else await assertFails(batch.commit());
  }
});

it('aísla A/B en ambas direcciones y rechaza anónimos y cuentas sin negocio', async () => {
  const own = env.authenticatedContext('A').firestore();
  await purchaseBatch(own).commit();
  for (const [owner, attacker] of [['A', 'B'], ['B', 'A']]) {
    const db = env.authenticatedContext(attacker!).firestore();
    await assertFails(getDoc(purchase(db, owner)));
    await assertFails(getDoc(reversal(db, owner)));
    await assertFails(getDocs(query(collection(db, 'businesses', owner!, 'purchases'), limit(26))));
    await assertFails(updateDoc(product(db, owner), { ...productChange() }));
    await assertFails(setDoc(purchase(db, owner), purchaseData()));
    await assertFails(deleteDoc(product(db, owner)));
  }
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('C')]) {
    await assertFails(purchaseBatch(context.firestore()).commit());
    await assertFails(getDoc(purchase(context.firestore())));
  }
  await assertFails(getDocs(collection(own, 'businesses', 'A', 'purchases')));
  await assertSucceeds(getDocs(query(collection(own, 'businesses', 'A', 'purchases'), limit(26))));
});
