import { useEffect, useRef, useState } from 'react';
import type { Command, DateFilter, QueryInput, RecordPage } from '../../../shared/commerce';
import { canonical, DomainError } from '../../../shared/commerce';
import type { CommerceService } from './CommerceRepository';

export function commerceError(cause: unknown): string {
  if (cause instanceof DomainError) return cause.message;
  const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : '';
  if (
    [
      'functions/invalid-argument',
      'functions/failed-precondition',
      'functions/already-exists',
    ].includes(String(code)) &&
    cause instanceof Error
  )
    return cause.message;
  if (code === 'functions/unauthenticated') return 'Inicia sesión de nuevo para continuar.';
  return 'No se confirmó la respuesta del servidor local. Comprueba que Auth, Firestore y Functions estén encendidos y vuelve a consultar.';
}
export function useRecords(
  service: CommerceService,
  resource: QueryInput['resource'],
  filter?: DateFilter,
) {
  const [page, setPage] = useState<RecordPage>({ items: [], next: null });
  const [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const from = filter?.from,
    to = filter?.to;
  useEffect(() => {
    let current = true;
    service.list(resource, from && to ? { from, to } : undefined, cursor).then(
      (result) => {
        if (current) {
          setPage(result);
          setLoading(false);
          setError('');
        }
      },
      (cause) => {
        if (current) {
          setError(commerceError(cause));
          setLoading(false);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [service, resource, from, to, cursor, revision]);
  return {
    ...page,
    loading,
    error,
    refresh: () => {
      setLoading(true);
      setRevision((value) => value + 1);
    },
    nextPage: () => {
      if (page.next) {
        setLoading(true);
        setCursor(page.next);
      }
    },
    firstPage: () => {
      setLoading(true);
      setCursor(undefined);
      setRevision((value) => value + 1);
    },
    hasPrevious: !!cursor,
  };
}
export function useCommerceCommand(
  uid: string,
  service: CommerceService,
  onSuccess: (id: string) => void,
) {
  const key = `khypupyme:pending-commerce:${uid}`;
  const [initial] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const command = raw ? (JSON.parse(raw) as Command) : null;
      if (command && (typeof command.operationId !== 'string' || !command.kind || !command.input))
        throw new Error();
      return { command, error: '' };
    } catch {
      return {
        command: null,
        error:
          'No se pudo recuperar la solicitud de esta pestaña. Consulta el historial antes de reiniciarla.',
      };
    }
  });
  const [pending, setPending] = useState(initial.command),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initial.error);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function execute(command: Command) {
    if (lock.current || !navigator.onLine || initial.error) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setRetryAllowed(false);
    try {
      if (sessionStorage.getItem(`khypupyme:pending-inventory:${uid}`))
        throw new DomainError('Resuelve primero la operación pendiente en Inventario o Compras.');
      const saved = sessionStorage.getItem(key);
      if (saved && canonical(JSON.parse(saved)) !== canonical(command))
        throw new DomainError(
          'Confirma primero la solicitud original pendiente, con sus mismos datos.',
        );
      sessionStorage.setItem(key, JSON.stringify(command));
      setPending(command);
      const result = await service.execute(command);
      sessionStorage.removeItem(key);
      if (alive.current) {
        setPending(null);
        onSuccess(result.id);
      }
    } catch (cause) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
      if (['functions/invalid-argument', 'functions/failed-precondition'].includes(code)) {
        sessionStorage.removeItem(key);
        if (alive.current) setPending(null);
      }
      if (alive.current) setError(commerceError(cause));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function consult() {
    if (!pending || lock.current || !navigator.onLine) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await service.status(pending.operationId);
      if (result) {
        sessionStorage.removeItem(key);
        setPending(null);
        onSuccess(result.id);
      } else {
        setRetryAllowed(true);
        setError(
          'La operación aún no aparece confirmada. Puedes reintentar la misma solicitud; conservará su identificador y sus datos.',
        );
      }
    } catch (cause) {
      setError(commerceError(cause));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return {
    pending,
    busy,
    error,
    execute,
    consult,
    retryAllowed,
    blocked: busy || !!pending || !!initial.error,
  };
}
