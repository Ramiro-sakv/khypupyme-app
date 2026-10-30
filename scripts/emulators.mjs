import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = ['emulators:start', '--project', 'demo-khypupyme', '--only', 'auth,firestore', '--export-on-exit', '.emulator-data'];
if (existsSync('.emulator-data/firebase-export-metadata.json')) args.push('--import', '.emulator-data');
const cli = fileURLToPath(import.meta.resolve('firebase-tools/lib/bin/firebase.js'));
const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' });
// Firebase recibe Ctrl+C en la misma consola y necesita terminar su exportación.
process.on('SIGINT', () => {});
child.on('error', (error) => { console.error('No se pudo iniciar Firebase Emulator:', error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
