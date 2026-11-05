import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/errors';
import { InventoryInputError } from './domain';
import type { InventoryService } from './InventoryService';
import type { PurchaseService } from '../purchases/PurchaseService';
import { clearPending, executePending, readPending, savePending } from './pendingOperation';
import type { PendingOperation } from './pendingOperation';

export function usePendingOperation(uid: string, inventory: InventoryService, purchases: PurchaseService, onComplete: (operation: PendingOperation) => void) {
  const [recovered] = useState(() => {
    try { return { pending: readPending(uid), error: '' }; }
    catch { return { pending: null, error: 'No se pudo leer la operación pendiente de esta pestaña. Consulta productos e historial antes de recuperar esta solicitud.' }; }
  });
  const [pending, setPending] = useState(recovered.pending);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function execute(operation: PendingOperation) {
    if (lock.current || !navigator.onLine || recovered.error) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const existing = readPending(uid);
      if (existing && existing.id !== operation.id) throw new Error('Resuelve primero la solicitud pendiente.');
      savePending(uid, operation); setPending(operation);
      await executePending(uid, operation, inventory, purchases);
      clearPending(uid);
      if (alive.current) { setPending(null); onComplete(operation); }
    } catch (cause) {
      if (cause instanceof InventoryInputError) {
        try { clearPending(uid); } catch { /* Conservar el registro si el navegador impide eliminarlo. */ }
        if (alive.current) { setPending(null); setError(cause.message); }
      } else if (alive.current) setError(errorMessage(cause));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return { pending, error, recoveryError: recovered.error, busy, execute };
}
