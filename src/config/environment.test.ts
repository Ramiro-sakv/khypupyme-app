import { describe, expect, it } from 'vitest';
import { readEnvironment } from './environment';

describe('aislamiento del entorno', () => {
  it('usa exclusivamente emuladores por defecto', () => expect(readEnvironment({}).projectId).toBe('demo-khypupyme'));
  it.each([{ VITE_FIREBASE_PROJECT_ID: 'negocio-real' }, { VITE_USE_EMULATORS: 'false' }, { VITE_FIREBASE_PROJECT_ID: 'demo-x/otro' }])('rechaza configuración remota o inválida: %j', (env) => expect(() => readEnvironment(env)).toThrow());
  it('separa el proyecto y los puertos de pruebas de la sesión interactiva', () => {
    expect(readEnvironment({ VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests', VITE_EMULATOR_PROFILE: 'test' })).toMatchObject({ firestorePort: 18080, authHost: 'http://127.0.0.1:19099' });
    expect(() => readEnvironment({ VITE_EMULATOR_PROFILE: 'test' })).toThrow();
    expect(() => readEnvironment({ VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests' })).toThrow();
    expect(() => readEnvironment({ VITE_EMULATOR_PROFILE: 'otro' })).toThrow();
  });
  it('solo admite portal HTTPS del perfil alojado en Windows', () => {
    const hosted = {
      VITE_USE_EMULATORS: 'false', VITE_SERVICE_PROFILE: 'hosted', VITE_RUNTIME_TARGET: 'windows',
      VITE_FIREBASE_PROJECT_ID: 'fixture-khypupyme', VITE_FIREBASE_API_KEY: 'fixture-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'fixture-khypupyme.firebaseapp.com', VITE_FIREBASE_APP_ID: 'fixture-app',
    };
    expect(() => readEnvironment(hosted)).toThrow();
    expect(() => readEnvironment({ ...hosted, VITE_KHYPU_CHECKOUT_ORIGIN: 'http://portal.example' })).toThrow();
    expect(() => readEnvironment({ ...hosted, VITE_KHYPU_CHECKOUT_ORIGIN: 'https://portal.example/pago' })).toThrow();
    expect(readEnvironment({ ...hosted, VITE_KHYPU_CHECKOUT_ORIGIN: 'https://portal.example' }).projectId).toBe('fixture-khypupyme');
  });
  it('permite Windows de simulación únicamente en el perfil de pruebas aislado', () => {
    const windows = { VITE_RUNTIME_TARGET: 'windows', VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests', VITE_EMULATOR_PROFILE: 'test' };
    expect(() => readEnvironment(windows)).toThrow();
    expect(readEnvironment({ ...windows, VITE_BILLING_SIMULATION: 'true' })).toMatchObject({
      authHost: 'http://127.0.0.1:19099', firestorePort: 18080, functionsPort: 15001,
    });
  });
  it('limita los destinos nativos habituales a sus emuladores locales', () => {
    expect(readEnvironment({ VITE_RUNTIME_TARGET: 'android' })).toMatchObject({ firestoreHost: '10.0.2.2', functionsPort: 5001 });
    expect(readEnvironment({ VITE_RUNTIME_TARGET: 'windows' }).firestoreHost).toBe('127.0.0.1');
    expect(() => readEnvironment({ VITE_RUNTIME_TARGET: 'cloud' })).toThrow();
    expect(() => readEnvironment({ VITE_RUNTIME_TARGET: 'android', VITE_EMULATOR_PROFILE: 'test', VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests' })).toThrow();
  });
});
