import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';
import { FirestoreBusinessRepository } from '../../src/features/business/FirestoreBusinessRepository';
import { FirebaseAuthService } from '../../src/features/auth/FirebaseAuthService';

it('persiste el perfil, mantiene idempotencia y restaura el acceso al iniciar sesión', async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Usa pnpm test:emulators. No se permite probar contra servicios reales.');
  const id = randomUUID();
  const email = `integration-${id}@example.invalid`;
  const password = 'una-frase-de-prueba-segura';
  const app = initializeApp({ projectId: 'demo-khypupyme', apiKey: 'demo-api-key' }, id);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const repository = new FirestoreBusinessRepository(db);
  const service = new FirebaseAuthService(auth);
  try {
    await service.register(email, password);
    const user = auth.currentUser;
    if (!user) throw new Error('No se creó la sesión del usuario de prueba.');
    expect(await repository.get(user.uid)).toBeNull();
    const created = await repository.create(user.uid, 'Tienda integración');
    expect(created.currency).toBe('BOB');
    expect(created.createdAt).toBeInstanceOf(Date);
    expect((await repository.create(user.uid, 'No debe reemplazar')).name).toBe('Tienda integración');
    await repository.rename(user.uid, 'Tienda actualizada');
    await service.logout();
    await expect(repository.get(user.uid)).rejects.toMatchObject({ code: 'permission-denied' });
    await service.login(email, password);
    expect((await repository.get(user.uid))?.name).toBe('Tienda actualizada');
    await service.resetPassword(email);
    const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-khypupyme/oobCodes');
    const links = await response.json() as { oobCodes: { email: string; requestType: string }[] };
    expect(links.oobCodes.some((code) => code.email === email && code.requestType === 'PASSWORD_RESET')).toBe(true);
    expect(created.id).toBe(user.uid);
  } finally { await terminate(db); await deleteApp(app); }
});
