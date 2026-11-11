import { randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';

export const project = 'demo-khypupyme';
export const hub = 'http://127.0.0.1:4400';
export const backupRoot = path.join(process.env.LOCALAPPDATA || homedir(), 'KhypuPyme', project);
const snapshotPattern = /^snapshot-\d{13}-[\da-f-]{36}$/;
const original = path.join(backupRoot, 'original');

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function requireFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || !stat.size) throw new Error('Archivo de respaldo faltante o vacío.');
  return stat;
}

export async function validateBackup(folder) {
  if (!(await lstat(folder)).isDirectory()) throw new Error('Carpeta de respaldo inválida.');
  const file = path.join(folder, 'firebase-export-metadata.json');
  const stamp = await requireFile(file);
  const metadata = await json(file);
  const firestore = 'firestore_export/firestore_export.overall_export_metadata';
  if (metadata.auth?.path !== 'auth_export' || metadata.firestore?.path !== 'firestore_export' ||
      metadata.firestore.metadata_file !== firestore) {
    throw new Error('El respaldo debe incluir Authentication y Firestore.');
  }
  for (const name of ['auth_export', 'firestore_export', 'firestore_export/all_namespaces/all_kinds']) {
    if (!(await lstat(path.join(folder, name))).isDirectory()) throw new Error('Carpeta de respaldo inválida.');
  }
  await requireFile(path.join(folder, 'auth_export/accounts.json'));
  await requireFile(path.join(folder, 'auth_export/config.json'));
  try {
    const accounts = await json(path.join(folder, 'auth_export/accounts.json'));
    const config = await json(path.join(folder, 'auth_export/config.json'));
    if (!Array.isArray(accounts?.users) || !config || typeof config !== 'object') throw new Error();
  } catch {
    throw new Error('Los archivos de Authentication no forman un respaldo legible.');
  }
  await requireFile(path.join(folder, firestore));
  const shardDir = path.join(folder, 'firestore_export/all_namespaces/all_kinds');
  await requireFile(path.join(shardDir, 'all_namespaces_all_kinds.export_metadata'));
  const shards = (await readdir(shardDir)).filter((name) => /^output-\d+$/.test(name));
  if (!shards.length) throw new Error('Faltan los datos exportados de Firestore.');
  // Un proyecto Firestore nuevo puede exportar un fragmento sin documentos.
  for (const name of shards) {
    if (!(await lstat(path.join(shardDir, name))).isFile()) throw new Error('Fragmento de respaldo inválido.');
  }
  return stamp.mtime;
}

async function snapshots() {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && snapshotPattern.test(entry.name))
    .map((entry) => entry.name).sort().reverse();
}

async function recoverFinishedBackup(current) {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  let recovered = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^pending-[\da-z]{6}$/i.test(entry.name)) continue;
    const folder = path.join(backupRoot, entry.name);
    const date = await validateBackup(folder).catch(() => null);
    if (date && (!current || date > current.date) && (!recovered || date > recovered.date)) recovered = { folder, date };
  }
  return recovered ? { ...recovered, folder: await publishBackup(recovered.folder) } : current;
}

export async function stagingBackup() {
  await mkdir(backupRoot, { recursive: true });
  return mkdtemp(path.join(backupRoot, 'pending-'));
}

export async function preserveOriginal(legacyFolder) {
  try { await lstat(original); return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await lstat(legacyFolder); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  await validateBackup(legacyFolder);
  const copy = await stagingBackup();
  await cp(legacyFolder, copy, { recursive: true, preserveTimestamps: true, force: false });
  await validateBackup(copy);
  try { await rename(copy, original); }
  catch (error) {
    if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code) || !(await lstat(original).catch(() => null))) throw error;
  }
}

export async function findBackup(legacyFolder, requested) {
  await mkdir(backupRoot, { recursive: true });
  if (requested !== undefined) {
    if (requested !== 'original' && !snapshotPattern.test(requested)) throw new Error('Indica el nombre de una copia local de KhypuPyme.');
    const folder = path.join(backupRoot, requested);
    const date = await validateBackup(folder).catch(() => null);
    if (!date) throw new Error(`No se pudo validar la copia elegida en ${folder}.`);
    return { folder, date };
  }
  const entries = await snapshots();
  let folder = entries.length ? path.join(backupRoot, entries[0]) : null;
  let legacyExists = false;
  try { await lstat(legacyFolder); legacyExists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!folder && legacyExists) folder = legacyFolder;
  if (!folder && await lstat(original).catch(() => null)) folder = original;
  if (folder && folder !== legacyFolder && legacyExists) {
    const metadata = 'firebase-export-metadata.json';
    // Una sesión que todavía usa el lanzador anterior puede cerrar después de la copia manual.
    const legacy = await lstat(path.join(legacyFolder, metadata)).catch(() => null);
    const latest = await lstat(path.join(folder, metadata)).catch(() => null);
    if (legacy && latest && legacy.mtimeMs > latest.mtimeMs) folder = legacyFolder;
  }
  if (!folder) return recoverFinishedBackup(null);
  try {
    const date = await validateBackup(folder);
    return recoverFinishedBackup({ folder, date });
  } catch {
    throw new Error(`El respaldo más reciente está incompleto. Se conservó en ${folder}. Revisa las copias anteriores antes de arrancar.`);
  }
}

export async function publishBackup(folder) {
  await validateBackup(folder);
  const completed = path.join(backupRoot, `snapshot-${Date.now()}-${randomUUID()}`);
  await rename(folder, completed);
  console.log(`Respaldo guardado · ${new Date().toLocaleString()} · ${completed}`);
  try {
    const folders = await snapshots();
    // Solo se rotan copias publicadas por este lanzador, nunca el respaldo original.
    const root = await realpath(backupRoot);
    let retained = 0;
    for (const name of folders) {
      const candidate = path.join(backupRoot, name);
      if (retained < 2) {
        try { await validateBackup(candidate); retained++; } catch { /* Conservar para recuperación. */ }
        continue;
      }
      const resolved = await realpath(candidate);
      if (path.dirname(resolved) === root && path.basename(resolved) === name) {
        await rm(candidate, { recursive: true, force: true });
      }
    }
  } catch {
    console.warn('El respaldo se guardó. Quedaron copias anteriores por revisar.');
  }
  return completed;
}

export async function localEmulators() {
  const locator = await json(path.join(tmpdir(), `hub-${project}.json`)).catch(() => null);
  const status = locator && await fetch(hub, { signal: AbortSignal.timeout(10_000), redirect: 'error' }).catch(() => null);
  if (!status?.ok || !locator.origins?.includes(hub) || (await status.json()).pid !== locator.pid) {
    throw new Error(`No se encontró el emulador local de ${project}.`);
  }
  const response = await fetch(`${hub}/emulators`, { signal: AbortSignal.timeout(10_000), redirect: 'error' }).catch(() => null);
  if (!response?.ok) throw new Error('El centro de emuladores no está listo.');
  return response.json();
}

export function requireEmulator(emulators, service, port) {
  if (emulators[service]?.host !== '127.0.0.1' || emulators[service]?.port !== port) {
    throw new Error(`Falta ${service} en 127.0.0.1:${port}.`);
  }
}

export async function saveBackup() {
  const emulators = await localEmulators();
  requireEmulator(emulators, 'auth', 9099);
  requireEmulator(emulators, 'firestore', 8080);
  const folder = await stagingBackup();
  const response = await fetch(`${hub}/_admin/export`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder, targets: ['auth', 'firestore'], initiatedBy: 'khypupyme' }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Firebase no terminó la exportación (${response.status}). Se conserva el respaldo anterior.`);
  return publishBackup(folder);
}
