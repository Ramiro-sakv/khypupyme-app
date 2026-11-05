import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

// No importar/exportar datos ni reutilizar la sesión interactiva del propietario.
for (const port of [18080, 19099, 19150, 14400, 14500, 4173]) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`El puerto de pruebas ${port} está ocupado. No se tocará su proceso.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
const cli = fileURLToPath(import.meta.resolve('firebase-tools/lib/bin/firebase.js'));
const child = spawn(process.execPath, [cli, 'emulators:exec', '--config', 'firebase.test.json', '--project', 'demo-khypupyme-tests', '--only', 'auth,firestore', 'pnpm test:integration && pnpm test:rules && pnpm test:e2e'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_FIREBASE_PROJECT_ID: 'demo-khypupyme-tests', VITE_EMULATOR_PROFILE: 'test' },
});
process.on('SIGINT', () => {});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
