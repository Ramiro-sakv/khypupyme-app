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
});
