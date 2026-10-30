import { describe, expect, it } from 'vitest';
import { readEnvironment } from './environment';

describe('aislamiento del entorno', () => {
  it('usa exclusivamente emuladores por defecto', () => expect(readEnvironment({}).projectId).toBe('demo-khypupyme'));
  it.each([{ VITE_FIREBASE_PROJECT_ID: 'negocio-real' }, { VITE_USE_EMULATORS: 'false' }, { VITE_FIREBASE_PROJECT_ID: 'demo-x/otro' }])('rechaza configuración remota o inválida: %j', (env) => expect(() => readEnvironment(env)).toThrow());
});
