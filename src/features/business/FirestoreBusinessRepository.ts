import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import type { Firestore, DocumentSnapshot } from 'firebase/firestore';
import { businessName } from './domain';
import type { Business, BusinessRepository } from './domain';

function decode(snapshot: DocumentSnapshot): Business | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (typeof data.name !== 'string' || data.ownerUid !== snapshot.id || data.currency !== 'BOB' || data.timeZone !== 'America/La_Paz' || !(data.createdAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp)) {
    throw new Error('El perfil guardado no tiene un formato válido.');
  }
  return { id: snapshot.id, ownerUid: data.ownerUid as string, name: data.name, currency: data.currency, timeZone: data.timeZone, createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() };
}

export class FirestoreBusinessRepository implements BusinessRepository {
  constructor(private readonly db: Firestore) {}

  private ref(uid: string) {
    if (!uid || uid.includes('/')) throw new Error('Identificador de usuario inválido.');
    return doc(this.db, 'businesses', uid);
  }

  async get(uid: string): Promise<Business | null> {
    return decode(await getDocFromServer(this.ref(uid)));
  }

  private async required(uid: string): Promise<Business> {
    const result = await this.get(uid);
    if (!result) throw new Error('No se encontró el negocio después del guardado.');
    return result;
  }

  async create(uid: string, value: string): Promise<Business> {
    const name = businessName(value);
    await runTransaction(this.db, async (transaction) => {
      const business = this.ref(uid);
      if ((await transaction.get(business)).exists()) return; // Reintentar no reemplaza el negocio existente.
      transaction.set(business, { name, ownerUid: uid, currency: 'BOB', timeZone: 'America/La_Paz', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    return this.required(uid);
  }

  async rename(uid: string, value: string): Promise<Business> {
    await updateDoc(this.ref(uid), { name: businessName(value), updatedAt: serverTimestamp() });
    return this.required(uid);
  }
}
