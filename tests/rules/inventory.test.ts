import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
type Firestore = ReturnType<RulesTestContext['firestore']>;

let env: RulesTestEnvironment;
const details = { name: 'Producto de prueba', priceMinor: 1230, minimumStock: 2 };
const product = (stock = 5) => ({ ...details, stock, active: true, lastMovementId: 'p1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const opening = (stock = 5) => ({ productId: 'p1', kind: 'opening', delta: stock, stockBefore: 0, stockAfter: stock, reason: 'Stock inicial', authorUid: 'A', initialProduct: details, createdAt: serverTimestamp() });
const refs = (db: Firestore, uid = 'A', id = 'op1') => ({ product: doc(db, 'businesses', uid, 'products', 'p1'), movement: doc(db, 'businesses', uid, 'inventoryMovements', id) });

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Usa pnpm test:emulators.');
  env = await initializeTestEnvironment({ projectId: 'demo-khypupyme', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    for (const uid of ['A', 'B']) await setDoc(doc(context.firestore(), 'businesses', uid), { ownerUid: uid });
  });
});
afterAll(async () => { await env?.cleanup(); });

async function create(stock = 5) {
  const db = env.authenticatedContext('A').firestore();
  const ref = refs(db, 'A', 'p1');
  const batch = writeBatch(db);
  batch.set(ref.product, product(stock)); batch.set(ref.movement, opening(stock));
  await assertSucceeds(batch.commit());
  return db;
}

function movementBatch(db: Firestore, change: Record<string, unknown> = {}, productChange: Record<string, unknown> = {}) {
  const ref = refs(db);
  const batch = writeBatch(db);
  batch.update(ref.product, { stock: 4, lastMovementId: 'op1', updatedAt: serverTimestamp(), ...productChange });
  batch.set(ref.movement, { productId: 'p1', kind: 'exit', delta: -1, stockBefore: 5, stockAfter: 4, reason: 'Rotura', authorUid: 'A', initialProduct: null, createdAt: serverTimestamp(), ...change });
  return batch;
}

it('crea stock inicial cero, permite metadatos y archiva sin borrar', async () => {
  const db = await create(0);
  const ref = refs(db);
  await assertSucceeds(updateDoc(ref.product, { name: 'Nombre nuevo', priceMinor: 1500, minimumStock: 3, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref.product, { active: false, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref.product, { active: true, updatedAt: serverTimestamp() }));
  expect((await getDoc(ref.product)).data()?.stock).toBe(0);
  await assertFails(deleteDoc(ref.product));
});
it('exige producto y movimiento inicial en la misma operación', async () => {
  const db = env.authenticatedContext('A').firestore();
  const ref = refs(db, 'A', 'p1');
  await assertFails(setDoc(ref.product, product()));
  await assertFails(setDoc(ref.movement, opening()));
});
it('permite salida y entrada atómicas con historial inmutable', async () => {
  const db = await create();
  await assertSucceeds(movementBatch(db).commit());
  const ref = refs(db, 'A', 'op2');
  const batch = writeBatch(db);
  batch.update(ref.product, { stock: 6, lastMovementId: 'op2', updatedAt: serverTimestamp() });
  batch.set(ref.movement, { productId: 'p1', kind: 'entry', delta: 2, stockBefore: 4, stockAfter: 6, reason: 'Compra', authorUid: 'A', initialProduct: null, createdAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(ref.movement, { reason: 'Reescrito' }));
  await assertFails(deleteDoc(ref.movement));
});
it('impide cambiar stock o inventar movimientos aislados y reutilizar operaciones', async () => {
  const db = await create();
  const ref = refs(db);
  await assertFails(updateDoc(ref.product, { stock: 4, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref.product, { stock: 4, lastMovementId: 'op1', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref.movement, { ...opening(), kind: 'entry', initialProduct: null }));
  await assertSucceeds(movementBatch(db).commit());
  await assertFails(movementBatch(db).commit());
  await assertFails(updateDoc(ref.product, { stock: 5, lastMovementId: 'p1', updatedAt: serverTimestamp() }));
});
it.each([
  { authorUid: 'B' }, { delta: -2 }, { stockBefore: 6 }, { stockAfter: -1 },
  { delta: -1.5 }, { kind: 'entry' }, { reason: '  ' }, { reason: 'a\nb' },
  { createdAt: Timestamp.fromMillis(0) }, { productId: 'otro' }, { admin: true },
  { initialProduct: details }, { stockAfter: 1000001 },
])('rechaza movimiento manipulado: %j', async (change) => {
  const db = await create();
  await assertFails(movementBatch(db, change).commit());
});
it.each([
  { stock: -1 }, { stock: 1.5 }, { stock: 1000001 }, { priceMinor: 0 }, { priceMinor: 1000000000 },
  { minimumStock: -1 }, { name: '  ' }, { name: 'a\nb' }, { name: 'x'.repeat(81) },
  { createdAt: Timestamp.fromMillis(0) }, { ownerUid: 'A' },
])('rechaza producto manipulado: %j', async (change) => {
  const db = await create();
  await assertFails(updateDoc(refs(db).product, { ...change, updatedAt: serverTimestamp() }));
});
it('impide combinar movimiento con edición y operar archivados, incluso al reactivarlos', async () => {
  const db = await create();
  await assertFails(movementBatch(db, {}, { name: 'Cambio oculto' }).commit());
  await updateDoc(refs(db).product, { active: false, updatedAt: serverTimestamp() });
  await assertFails(movementBatch(db).commit());
  await assertFails(movementBatch(db, {}, { active: true }).commit());
});
it('rechaza otro negocio, usuarios anónimos y cuentas sin negocio', async () => {
  await create();
  for (const context of [env.authenticatedContext('B'), env.unauthenticatedContext()]) {
    const db = context.firestore();
    await assertFails(getDoc(refs(db).product));
    await assertFails(getDoc(refs(db, 'A', 'p1').movement));
    await assertFails(getDocs(query(collection(db, 'businesses', 'A', 'products'), limit(26))));
    await assertFails(movementBatch(db).commit());
    await assertFails(updateDoc(refs(db).product, { name: 'Usurpado', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(refs(db).product));
  }
  const db = env.authenticatedContext('C').firestore();
  await assertFails(getDocs(query(collection(db, 'businesses', 'C', 'products'), limit(26))));
});
it('limita consultas y sigue denegando otros módulos comerciales', async () => {
  const db = await create();
  await assertSucceeds(getDocs(query(collection(db, 'businesses', 'A', 'products'), limit(26))));
  await assertFails(getDocs(collection(db, 'businesses', 'A', 'products')));
  await assertFails(getDocs(query(collection(db, 'businesses', 'A', 'inventoryMovements'), limit(27))));
  for (const name of ['sales', 'expenses', 'receivables', 'payments']) {
    await assertFails(setDoc(doc(db, 'businesses', 'A', name, 'registro'), { amountMinor: 100 }));
  }
});

it.each([
  { kind: 'exit', delta: -6, stockAfter: -1 },
  { kind: 'entry', delta: 1000000, stockAfter: 1000005 },
  { kind: 'entry', delta: 0, stockAfter: 5 },
  { kind: 'entry', delta: 0.5, stockAfter: 5.5 },
  { kind: 'opening', delta: -1, stockAfter: 4 },
])('rechaza pares coherentes pero inválidos: %j', async (change) => {
  const db = await create();
  await assertFails(movementBatch(db, change, { stock: change.stockAfter }).commit());
});

it.each([
  { initialProduct: { ...details, priceMinor: 999 } },
  { initialProduct: { ...details, admin: true } },
  { authorUid: 'B' }, { reason: 'Otro motivo' }, { productId: 'otro' }, { stockBefore: 1, delta: 4 },
])('rechaza apertura falsificada aunque se adjunte un producto: %j', async (change) => {
  const db = env.authenticatedContext('A').firestore();
  const ref = refs(db, 'A', 'p1');
  const batch = writeBatch(db);
  batch.set(ref.product, product()); batch.set(ref.movement, { ...opening(), ...change });
  await assertFails(batch.commit());
});

it('un solo cambio de stock no acredita dos movimientos y no admite pérdida de campos', async () => {
  const db = await create();
  const batch = movementBatch(db);
  batch.set(refs(db, 'A', 'op2').movement, { productId: 'p1', kind: 'exit', delta: -1, stockBefore: 5, stockAfter: 4, reason: 'Duplicado', authorUid: 'A', initialProduct: null, createdAt: serverTimestamp() });
  await assertFails(batch.commit());
  await assertFails(setDoc(refs(db).product, { ...details, stock: 5, updatedAt: serverTimestamp() }));
});
