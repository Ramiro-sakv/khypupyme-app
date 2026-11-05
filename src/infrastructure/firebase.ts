import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import { readEnvironment } from '../config/environment';
import { FirebaseAuthService } from '../features/auth/FirebaseAuthService';
import type { BusinessRepository } from '../features/business/domain';

export function createServices() {
  const config = readEnvironment(import.meta.env);
  const app = initializeApp({ projectId: config.projectId, apiKey: 'demo-api-key', authDomain: `${config.projectId}.firebaseapp.com` });
  const auth = initializeAuth(app, { persistence: browserSessionPersistence });
  // El aviso local permanente de App reemplaza el cartel flotante del SDK en móvil.
  connectAuthEmulator(auth, config.authHost, { disableWarnings: true });
  auth.languageCode = 'es';
  const authService = new FirebaseAuthService(auth);
  // Firestore se descarga solo al consultar el negocio después de autenticarse.
  let repository: Promise<BusinessRepository> | undefined;
  const load = () => repository ??= import('./business-services').then(({ createBusinessServices }) => createBusinessServices(app, config));
  const businessRepository: BusinessRepository = {
    get: async (uid) => (await load()).get(uid),
    create: async (uid, name) => (await load()).create(uid, name),
    rename: async (uid, name) => (await load()).rename(uid, name),
  };
  return { authService, businessRepository };
}
