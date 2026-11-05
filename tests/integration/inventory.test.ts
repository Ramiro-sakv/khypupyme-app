import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';
import { FirebaseAuthService } from '../../src/features/auth/FirebaseAuthService';
import { FirestoreBusinessRepository } from '../../src/features/business/FirestoreBusinessRepository';
import { FirestoreInventoryRepository } from '../../src/features/inventory/FirestoreInventoryRepository';
import { InventoryService } from '../../src/features/inventory/InventoryService';

async function session() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Usa pnpm test:emulators.');
  const id = randomUUID();
  const app = initializeApp({ projectId: 'demo-khypupyme', apiKey: 'demo-api-key' }, id);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await new FirebaseAuthService(auth).register(`inventory-${id}@example.invalid`, 'una-frase-de-prueba-segura');
  const uid = auth.currentUser!.uid;
  await new FirestoreBusinessRepository(db).create(uid, 'Negocio inventario');
  return { uid, service: new InventoryService(new FirestoreInventoryRepository(db)), close: async () => { await terminate(db); await deleteApp(app); } };
}

const initial = { name: 'Arroz', priceMinor: 1250, minimumStock: 2, stock: 5 };

it('crea, edita y archiva sin alterar historial; reintenta usando la solicitud original', async () => {
  const { uid, service, close } = await session();
  try {
    const id = randomUUID();
    const created = await service.create(uid, id, initial);
    expect(created.createdAt.getTime()).toBeGreaterThan(0);
    expect((await service.create(uid, id, initial)).id).toBe(id);
    await expect(service.create(uid, id, { ...initial, stock: 6 })).rejects.toThrow('otra operación');
    await service.update(uid, id, { ...initial, name: 'Arroz nuevo', priceMinor: 1300 });
    const operation = randomUUID();
    const change = { kind: 'exit' as const, quantity: 2, reason: 'Rotura de envase' };
    await service.move(uid, id, operation, change);
    await service.move(uid, id, operation, change);
    await expect(service.move(uid, id, operation, { ...change, quantity: 1 })).rejects.toThrow('otra operación');
    await service.setActive(uid, id, false);
    expect((await service.list(uid, true)).items).toHaveLength(0);
    expect((await service.list(uid, false)).items[0]?.stock).toBe(3);
    await expect(service.move(uid, id, randomUUID(), change)).rejects.toThrow('Reactiva');
    expect((await service.create(uid, id, initial)).id).toBe(id); // También después de editar y archivar.
    await service.setActive(uid, id, true);
    const history = await service.history(uid, id);
    expect(history.items).toHaveLength(2);
    expect(history.items.map((movement) => movement.delta)).toEqual([-2, 5]);
    expect((await service.list(uid, true)).items[0]).toMatchObject({ name: 'Arroz nuevo', priceMinor: 1300, stock: 3 });
  } finally { await close(); }
});

it('dos salidas concurrentes no sobrepasan el stock y un reintento concurrente solo aplica una vez', async () => {
  const { uid, service, close } = await session();
  try {
    const id = randomUUID();
    await service.create(uid, id, { ...initial, stock: 1 });
    const results = await Promise.allSettled([1, 2].map(() => service.move(uid, id, randomUUID(), { kind: 'exit', quantity: 1, reason: 'Salida de prueba' })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await Promise.all([1, 2].map(() => service.move(uid, id, randomUUID(), { kind: 'entry', quantity: 1, reason: 'Compras simultáneas' })));
    const operation = randomUUID();
    await Promise.all([1, 2].map(() => service.move(uid, id, operation, { kind: 'entry', quantity: 3, reason: 'Compra de prueba' })));
    expect((await service.list(uid, true)).items[0]?.stock).toBe(5);
    expect((await service.history(uid, id)).items).toHaveLength(5);
  } finally { await close(); }
});

it('pagina productos e historial sin perder ni duplicar registros', async () => {
  const { uid, service, close } = await session();
  try {
    const ids = Array.from({ length: 27 }, () => randomUUID());
    await Promise.all(ids.map((id) => service.create(uid, id, initial)));
    const first = await service.list(uid, true);
    expect(first.items).toHaveLength(25);
    expect(first.next).not.toBeNull();
    const second = await service.list(uid, true, first.next!);
    expect(second.items).toHaveLength(2);
    expect(second.next).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(27);
    const productId = ids[0]!;
    for (let i = 0; i < 26; i++) await service.move(uid, productId, randomUUID(), { kind: 'entry', quantity: 1, reason: 'Compra de prueba' });
    const history = await service.history(uid, productId);
    const remaining = await service.history(uid, productId, history.next!);
    expect(history.items).toHaveLength(25);
    expect(remaining.items).toHaveLength(2);
    expect(new Set([...history.items, ...remaining.items].map((item) => item.id)).size).toBe(27);
  } finally { await close(); }
}, 60000);
