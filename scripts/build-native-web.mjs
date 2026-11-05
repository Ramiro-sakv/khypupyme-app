const target = process.argv[2];
if (!['android', 'windows'].includes(target)) throw new Error('Destino nativo inválido.');
Object.assign(process.env, {
  VITE_RUNTIME_TARGET: target,
  VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme',
  VITE_EMULATOR_PROFILE: 'local',
  VITE_USE_EMULATORS: 'true',
});
process.env.RAYON_NUM_THREADS ??= '2';
const { build } = await import('vite');
await build({ build: { outDir: `dist-${target}` } });
