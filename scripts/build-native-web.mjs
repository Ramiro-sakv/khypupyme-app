const target = process.argv[2];
if (!['android', 'windows'].includes(target)) throw new Error('Destino nativo inválido.');
const simulation = process.argv.includes('--simulation');
if (simulation && target !== 'windows') throw new Error('El instalador de simulación es para Windows.');

if (simulation) {
  Object.assign(process.env, {
    VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests',
    VITE_EMULATOR_PROFILE: 'test',
    VITE_USE_EMULATORS: 'true',
    VITE_SERVICE_PROFILE: '',
    VITE_BILLING_SIMULATION: 'true',
    VITE_KHYPU_SIGNUP_CODE: 'true',
    VITE_KHYPU_CHECKOUT_ORIGIN: '',
  });
} else if (['hosted', 'render-pilot'].includes(process.env.VITE_SERVICE_PROFILE)) {
  if (process.env.VITE_USE_EMULATORS !== 'false') throw new Error('El perfil alojado requiere VITE_USE_EMULATORS=false.');
  const { readEnvironment } = await import('../src/config/environment.ts');
  readEnvironment({ ...process.env, VITE_RUNTIME_TARGET: target });
} else {
  Object.assign(process.env, {
    VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme',
    VITE_EMULATOR_PROFILE: 'local',
    VITE_USE_EMULATORS: 'true',
  });
}
process.env.VITE_RUNTIME_TARGET = target;
process.env.RAYON_NUM_THREADS ??= '2';
const { build } = await import('vite');
await build({ build: { outDir: simulation ? 'dist-windows-simulation' : `dist-${target}` } });
