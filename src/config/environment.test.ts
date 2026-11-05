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
  it('limita el destino nativo a emuladores locales y prohíbe mezclarlo con pruebas web', () => {
    expect(readEnvironment({ VITE_RUNTIME_TARGET: 'android' })).toMatchObject({ firestoreHost: '10.0.2.2', functionsPort: 5001 });
    expect(readEnvironment({ VITE_RUNTIME_TARGET: 'windows' }).firestoreHost).toBe('127.0.0.1');
    expect(() => readEnvironment({ VITE_RUNTIME_TARGET: 'cloud' })).toThrow();
    expect(() => readEnvironment({ VITE_RUNTIME_TARGET: 'android', VITE_EMULATOR_PROFILE: 'test', VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests' })).toThrow();
  });
});
