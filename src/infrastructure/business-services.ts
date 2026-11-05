import type { FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { FirestoreBusinessRepository } from '../features/business/FirestoreBusinessRepository';
import { FirestoreInventoryRepository } from '../features/inventory/FirestoreInventoryRepository';
import { FirestorePurchaseRepository } from '../features/purchases/FirestorePurchaseRepository';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { FirebaseCommerceRepository } from '../features/commerce/FirebaseCommerceRepository';
import type { readEnvironment } from '../config/environment';

export function createBusinessServices(app: FirebaseApp, config: ReturnType<typeof readEnvironment>) {
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, config.firestoreHost, config.firestorePort);
  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, config.firestoreHost, config.functionsPort);
  return { businessRepository: new FirestoreBusinessRepository(db), inventoryRepository: new FirestoreInventoryRepository(db), purchaseRepository: new FirestorePurchaseRepository(db), commerceRepository: new FirebaseCommerceRepository(functions) };
}
