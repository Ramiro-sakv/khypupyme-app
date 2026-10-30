export function readEnvironment(env: Record<string, unknown>) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-khypupyme';
  const useEmulators = env.VITE_USE_EMULATORS ?? 'true';
  if (typeof projectId !== 'string' || !/^demo-[a-z0-9-]+$/.test(projectId) || useEmulators !== 'true') {
    throw new Error('Esta versión solo admite proyectos demo y emuladores locales. Revisa .env.local.');
  }
  return { projectId, authHost: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8080 };
}
