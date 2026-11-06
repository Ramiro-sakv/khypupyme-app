import { useSyncExternalStore } from 'react';
const changed = 'khypupyme:pending-changed';
export function pendingRequestsChanged(): void {
  window.dispatchEvent(new Event(changed));
}
export function hasPendingRequest(uid: string, kind: 'inventory' | 'commerce'): boolean {
  try {
    return sessionStorage.getItem(`khypupyme:pending-${kind}:${uid}`) !== null;
  } catch {
    return true;
  } // No bloquear el acceso a recuperación si el navegador niega almacenamiento.
}
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  return () => window.removeEventListener(changed, listener);
}
export function usePendingRequests(uid: string | undefined) {
  const mask = useSyncExternalStore(
    subscribe,
    () =>
      uid
        ? Number(hasPendingRequest(uid, 'inventory')) +
          2 * Number(hasPendingRequest(uid, 'commerce'))
        : 0,
    () => 0,
  );
  return { inventory: !!(mask & 1), commerce: !!(mask & 2) };
}
