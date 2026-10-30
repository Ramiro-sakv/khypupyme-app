import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, initializeAuth, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { readEnvironment } from '../config/environment';
import type { AuthService } from '../features/auth/types';
import type { BusinessRepository } from '../features/business/domain';

export function createServices() {
  const config = readEnvironment(import.meta.env);
  const app = initializeApp({ projectId: config.projectId, apiKey: 'demo-api-key', authDomain: `${config.projectId}.firebaseapp.com` });
  const auth = initializeAuth(app, { persistence: browserSessionPersistence });
  // El aviso local permanente de App reemplaza el cartel flotante del SDK en móvil.
  connectAuthEmulator(auth, config.authHost, { disableWarnings: true });
  auth.languageCode = 'es';
  const authService: AuthService = {
    observe: (next, error) => onAuthStateChanged(auth, next, error),
    register: async (email, password) => { await createUserWithEmailAndPassword(auth, email, password); },
    login: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
    logout: () => signOut(auth),
    resetPassword: async (email) => {
      try { await sendPasswordResetEmail(auth, email); }
      catch (cause) {
        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'auth/user-not-found') return;
        throw cause;
      }
    },
  };
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
