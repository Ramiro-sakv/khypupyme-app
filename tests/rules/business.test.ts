import { industryConfiguration } from '../../shared/business-configuration';
import { INDUSTRY_IDS } from '../../shared/business-industries';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const valid = (uid: string) => ({
  name: 'Tienda de prueba',
  ownerUid: uid,
  currency: 'BOB',
  timeZone: 'America/La_Paz',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080')
    throw new Error('Ejecuta pnpm test:emulators para probar reglas localmente.');
  env = await initializeTestEnvironment({
    projectId: 'demo-khypupyme-tests',
    firestore: { host: '127.0.0.1', port: 18080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(async () => {
  await env?.cleanup();
});

it('A y B pueden crear, leer y modificar exclusivamente su perfil', async () => {
  for (const uid of ['A', 'B']) {
    const ref = doc(env.authenticatedContext(uid).firestore(), 'businesses', uid);
    await assertSucceeds(setDoc(ref, valid(uid)));
    expect((await assertSucceeds(getDoc(ref))).data()?.ownerUid).toBe(uid);
    await assertSucceeds(updateDoc(ref, { name: 'Nuevo nombre', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref)); // La baja requiere un procedimiento controlado; no se borra el historial.
  }
});
it('rechaza creación, lectura, modificación y eliminación cruzadas en ambas direcciones', async () => {
  for (const [owner, other] of [
    ['A', 'B'],
    ['B', 'A'],
  ] as const) {
    const ownRef = doc(env.authenticatedContext(owner).firestore(), 'businesses', owner);
    const otherRef = doc(env.authenticatedContext(other).firestore(), 'businesses', owner);
    await assertFails(setDoc(otherRef, valid(other)));
    await assertSucceeds(setDoc(ownRef, valid(owner)));
    await assertFails(getDoc(otherRef));
    await assertFails(updateDoc(otherRef, { name: 'Usurpado', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(otherRef));
  }
});
it('deniega todas las operaciones sin autenticación', async () => {
  const ref = doc(env.unauthenticatedContext().firestore(), 'businesses', 'A');
  await assertFails(setDoc(ref, valid('A')));
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { name: 'Sin permiso' }));
  await assertFails(deleteDoc(ref));
});
it.each([
  { name: '' },
  { name: '   ' },
  { name: 42 },
  { name: 'x'.repeat(81) },
  { ownerUid: 'B' },
  { currency: 'USD' },
  { timeZone: 'UTC' },
  { role: 'admin' },
  { createdAt: Timestamp.fromMillis(0) },
  { updatedAt: 'hoy' },
])('rechaza datos y privilegios inválidos: %j', async (change) => {
  await assertFails(
    setDoc(doc(env.authenticatedContext('A').firestore(), 'businesses', 'A'), {
      ...valid('A'),
      ...change,
    }),
  );
});
it('protege propiedad, fechas de creación, moneda y zona horaria de actualizaciones', async () => {
  const ref = doc(env.authenticatedContext('A').firestore(), 'businesses', 'A');
  await setDoc(ref, valid('A'));
  for (const change of [
    { ownerUid: 'B' },
    { createdAt: Timestamp.fromMillis(0) },
    { currency: 'USD' },
    { timeZone: 'UTC' },
    { role: 'owner' },
  ]) {
    await assertFails(updateDoc(ref, { ...change, updatedAt: serverTimestamp() }));
  }
});
it('no permite enumerar negocios ni acceder a módulos comerciales todavía cerrados', async () => {
  const db = env.authenticatedContext('A').firestore();
  await assertFails(getDocs(collection(db, 'businesses')));
  for (const name of ['products', 'sales', 'expenses', 'receivables']) {
    const ref = doc(db, 'businesses', 'A', name, 'registro');
    await assertFails(setDoc(ref, { amountMinor: 100 }));
    await assertFails(getDoc(ref));
  }
});

const configuration = { profileId: 'retail', version: 1, tools: ['inventory', 'purchases'] };
it('crea perfil válido, permite renombrar y exige servidor para cambiar herramientas', async () => {
  const db = env.authenticatedContext('A').firestore(),
    ref = doc(db, 'businesses', 'A');
  await assertSucceeds(
    setDoc(ref, { ...valid('A'), activity: 'commerce', configuration, configurationRevision: 1 }),
  );
  await assertSucceeds(updateDoc(ref, { name: 'Nombre nuevo', updatedAt: serverTimestamp() }));
  await assertFails(
    updateDoc(ref, {
      configuration: { ...configuration, tools: [] },
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(updateDoc(ref, { configurationRevision: 2, updatedAt: serverTimestamp() }));
});
it.each([
  { configuration: { ...configuration, version: 2 } },
  { configuration: { ...configuration, profileId: 'wood' } },
  { configuration: { ...configuration, tools: ['purchases'] } },
  { configuration: { ...configuration, tools: ['inventory', 'inventory'] } },
  { configuration: { ...configuration, tools: ['factory'] } },
  { configuration: { ...configuration, ownerUid: 'B' } },
  { configurationRevision: 0 },
  { configurationRevision: 2 },
  { activity: 'services' },
])('rechaza perfil manipulado %j', async (change) => {
  await assertFails(
    setDoc(doc(env.authenticatedContext('A').firestore(), 'businesses', 'A'), {
      ...valid('A'),
      activity: 'commerce',
      configuration,
      configurationRevision: 1,
      ...change,
    }),
  );
});
it('no acepta configuración sin revisión ni revisión sin configuración', async () => {
  const ref = doc(env.authenticatedContext('A').firestore(), 'businesses', 'A');
  await assertFails(setDoc(ref, { ...valid('A'), configuration }));
  await assertFails(setDoc(ref, { ...valid('A'), configurationRevision: 1 }));
});

it.each(INDUSTRY_IDS)('crea el negocio con rubro %s en su perfil', async (id) => {
  const configuration = industryConfiguration(id),
    ref = doc(env.authenticatedContext('A').firestore(), 'businesses', 'A');
  const activity = configuration.tools.includes('services')
    ? configuration.tools.includes('inventory')
      ? 'mixed'
      : 'services'
    : 'commerce';
  await assertSucceeds(
    setDoc(ref, { ...valid('A'), configuration, configurationRevision: 1, activity }),
  );
});
it.each([
  { ...industryConfiguration('timber'), industryId: 'fake' },
  { ...industryConfiguration('timber'), profileId: 'services' },
])('deniega rubro o familia falsificados %j', async (configuration) => {
  await assertFails(
    setDoc(doc(env.authenticatedContext('A').firestore(), 'businesses', 'A'), {
      ...valid('A'),
      configuration,
      configurationRevision: 1,
      activity: 'commerce',
    }),
  );
});
