export function readEnvironment(env: Record<string, unknown>) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-khypupyme';
  const useEmulators = env.VITE_USE_EMULATORS ?? 'true';
  const profile = env.VITE_EMULATOR_PROFILE ?? 'local';
  if (typeof projectId !== 'string' || !/^demo-[a-z0-9-]+$/.test(projectId) || useEmulators !== 'true'
    || !['local', 'test'].includes(profile as string)
    || (profile === 'test' && projectId !== 'demo-khypupyme-tests')
    || (profile !== 'test' && projectId === 'demo-khypupyme-tests')) {
    throw new Error('Esta versión solo admite proyectos demo y emuladores locales. Revisa .env.local.');
  }
  const target = env.VITE_RUNTIME_TARGET ?? 'web';
  if (!['web', 'android', 'windows'].includes(target as string) || (profile === 'test' && target !== 'web')) throw new Error('Destino local inválido.');
  const host = target === 'android' ? '10.0.2.2' : '127.0.0.1';
  return { projectId, authHost: `http://${host}:${profile === 'test' ? 19099 : 9099}`, firestoreHost: host, firestorePort: profile === 'test' ? 18080 : 8080, functionsPort: profile === 'test' ? 15001 : 5001 };
}
