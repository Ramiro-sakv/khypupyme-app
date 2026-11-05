import type { FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { FirestoreBusinessRepository } from '../features/business/FirestoreBusinessRepository';
import type { readEnvironment } from '../config/environment';

export function createBusinessServices(app: FirebaseApp, config: ReturnType<typeof readEnvironment>) {
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, config.firestoreHost, config.firestorePort);
  return new FirestoreBusinessRepository(db);
}
