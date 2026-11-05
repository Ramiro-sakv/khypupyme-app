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
  return { projectId, authHost: `http://127.0.0.1:${profile === 'test' ? 19099 : 9099}`, firestoreHost: '127.0.0.1', firestorePort: profile === 'test' ? 18080 : 8080 };
}
