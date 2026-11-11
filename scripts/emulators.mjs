import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { findBackup, localEmulators, preserveOriginal, project, publishBackup, requireEmulator, saveBackup, stagingBackup } from './emulator-backups.mjs';

const functions = [
  'commerceCommand', 'commerceQuery', 'commerceReport', 'timberTutorial',
  'workspaceAccount', 'workspaceApproval', 'workspaceCommand', 'workspaceQuery',
  'workspaceReport', 'workspaceStatus',
];
const legacy = fileURLToPath(new URL('../.emulator-data', import.meta.url));

async function checkServices() {
  const emulators = await localEmulators();
  requireEmulator(emulators, 'auth', 9099);
  requireEmulator(emulators, 'firestore', 8080);
  requireEmulator(emulators, 'functions', 5001);
  for (const [name, url] of [
    ['Authentication', `http://127.0.0.1:9099/emulator/v1/projects/${project}/config`],
    ['Firestore', 'http://127.0.0.1:8080/'],
  ]) {
    const health = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'error' })
      .catch(() => null);
    if (!health?.ok) throw new Error(`${name} todavía no responde.`);
    await health.body?.cancel();
  }
  const response = await fetch(`http://127.0.0.1:5001/${project}/us-central1/workspaceAccount`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { kind: 'list', input: {} } }),
    signal: AbortSignal.timeout(5000),
  });
  // La cuenta exige sesión. La respuesta identifica una función ejecutable, sin leer datos.
  if (response.status !== 401 || (await response.json()).error?.status !== 'UNAUTHENTICATED') {
    throw new Error('Functions todavía no responde con el contrato esperado.');
  }
}

async function start() {
  console.log('KhypuPyme · preparando emuladores');
  if (await localEmulators().catch(() => null)) {
    throw new Error('Ya existe una sesión de emuladores de KhypuPyme. Usa esa sesión o ciérrala con Ctrl+C antes de iniciar otra.');
  }
  const restore = process.argv.indexOf('--restore');
  const imported = await findBackup(legacy, restore < 0 ? undefined : (process.argv[restore + 1] ?? ''));
  if (!imported && !process.argv.includes('--empty')) {
    throw new Error('No hay respaldo local. Si este entorno es nuevo, inicia con pnpm emulators --empty.');
  }
  if (imported) console.log(`Restaurando respaldo del ${imported.date.toLocaleString()} · ${imported.folder}`);
  else console.warn('Primer arranque con Auth y Firestore vacíos.');
  const exitBackup = await stagingBackup();
  const args = ['emulators:start', '--project', project, '--only', 'auth,firestore,functions', '--export-on-exit', exitBackup];
  if (imported) args.push('--import', imported.folder);
  const cli = fileURLToPath(import.meta.resolve('firebase-tools/lib/bin/firebase.js'));
  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '30' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const loaded = new Set();
  let stopped = false, stopping = false, ready = false, checkpoint;
  let failure = '';
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      // El aviso genérico de Firebase aparece incluso si no pudo cargar Functions.
      if (!line.includes('All emulators ready!')) console.log(line);
      const name = /functions\[us-central1-([\w-]+)\]: http function initialized/.exec(line)?.[1];
      if (name) loaded.add(name);
      if (/Failed to load function definition/i.test(line)) failure = 'Functions no pudo cargar las operaciones.';
      if (/failed to import|error importing|could not import/i.test(line)) failure = 'Firebase no pudo restaurar el respaldo.';
    });
  }
  let interval;
  // Ctrl+C llega al proceso de Firebase en la misma consola y permite su exportación final.
  const stop = () => { stopping = true; clearInterval(interval); };
  process.on('SIGINT', stop);
  process.on('SIGHUP', stop);
  const exit = new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('close', (code) => resolve(code ?? 1));
  }).then(async (code) => {
    stopped = true;
    clearInterval(interval);
    await checkpoint;
    if (ready) {
      try { await publishBackup(exitBackup); }
      catch { console.warn('El respaldo de cierre quedó incompleto. Se conserva la última copia confirmada.'); }
    }
    return code;
  });
  let waitingFor = 'Auth, Firestore y Functions';
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !stopped && !stopping && !failure) {
    const missing = functions.filter((name) => !loaded.has(name));
    if (missing.length) waitingFor = `Functions (${missing.join(', ')})`;
    else {
      try { await checkServices(); ready = !stopping && !stopped && !failure; break; }
      catch (error) { waitingFor = error.message; }
    }
    await wait(1000);
  }
  if (ready) {
    console.log('KhypuPyme · emuladores listos (Auth, Firestore y Functions).');
    interval = setInterval(() => {
      if (checkpoint || stopping) return;
      checkpoint = saveBackup()
        .catch(() => console.warn('Falló el respaldo periódico. Se conserva la última copia confirmada.'))
        .finally(() => { checkpoint = undefined; });
    }, 5 * 60 * 1000);
  } else if (!stopping) {
    console.error(`KhypuPyme · arranque incompleto. ${failure || `Pendiente: ${waitingFor}.`} Revisa la consola y usa Ctrl+C antes de volver a iniciar.`);
  }
  process.exitCode = (await exit) || (ready || stopping ? 0 : 1);
}

try {
  await preserveOriginal(legacy).catch(() => console.warn('No se pudo duplicar la copia original. Se conserva en su carpeta.'));
  if (process.argv.includes('--backup')) await saveBackup();
  else await start();
} catch (error) {
  console.error(`KhypuPyme · ${error.message}`);
  process.exitCode = 1;
}
