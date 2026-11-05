import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, it } from 'vitest';
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
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { requireTestEmulators, testFirestorePort, testProjectId } from '../emulator-environment';
let env: RulesTestEnvironment;
const resources = [
  'sales',
  'expenses',
  'receivables',
  'payments',
  'customers',
  'services',
  'cashEvents',
];
beforeAll(async () => {
  requireTestEmulators();
  env = await initializeTestEnvironment({
    projectId: testProjectId,
    firestore: {
      host: '127.0.0.1',
      port: testFirestorePort,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of ['A', 'B']) {
      await setDoc(doc(db, 'businesses', uid), {
        ownerUid: uid,
        name: 'Negocio ficticio',
        currency: 'BOB',
        timeZone: 'America/La_Paz',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      for (const name of [...resources, 'operations'])
        await setDoc(doc(db, 'businesses', uid, name, 'fixture'), {
          amountMinor: 100,
          authorUid: uid,
        });
    }
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it.each(resources)(
  '%s solo permite lecturas limitadas del propietario y deniega escritura incluso propia',
  async (resource) => {
    for (const [uid, other] of [
      ['A', 'B'],
      ['B', 'A'],
    ] as const) {
      const db = env.authenticatedContext(uid).firestore(),
        own = doc(db, 'businesses', uid, resource, 'fixture');
      await assertSucceeds(getDoc(own));
      await assertSucceeds(getDocs(query(collection(db, 'businesses', uid, resource), limit(26))));
      await assertFails(getDocs(collection(db, 'businesses', uid, resource)));
      await assertFails(getDocs(query(collection(db, 'businesses', uid, resource), limit(27))));
      await assertFails(setDoc(own, { amountMinor: 1 }));
      await assertFails(updateDoc(own, { status: 'paid', authorUid: other }));
      await assertFails(deleteDoc(own));
      await assertFails(getDoc(doc(db, 'businesses', other, resource, 'fixture')));
      await assertFails(
        getDoc(
          doc(env.unauthenticatedContext().firestore(), 'businesses', uid, resource, 'fixture'),
        ),
      );
    }
  },
);
it('el registro de idempotencia permanece privado y no admite escrituras desde el cliente', async () => {
  const ref = doc(
    env.authenticatedContext('A').firestore(),
    'businesses',
    'A',
    'operations',
    'fixture',
  );
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { signature: 'falsificada' }));
  await assertFails(deleteDoc(ref));
});
