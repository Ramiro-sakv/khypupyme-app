export const testProjectId = 'demo-khypupyme-tests';
export const testFirestorePort = 18080;
export const testAuthUrl = 'http://127.0.0.1:19099';

export function requireTestEmulators(): void {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') {
    throw new Error('Usa pnpm test:emulators. Solo se permiten emuladores efímeros de pruebas.');
  }
}
