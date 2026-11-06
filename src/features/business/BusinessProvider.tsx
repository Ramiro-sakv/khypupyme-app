import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/auth-context';
import type { Business, BusinessRepository } from './domain';
import { BusinessContext } from './business-context';
import { errorMessage } from '../../shared/errors';

export function BusinessProvider({
  repository,
  children,
}: {
  repository: BusinessRepository;
  children: ReactNode;
}) {
  const { user } = useAuth(),
    uid = user?.uid;
  const [result, setResult] = useState<{ uid: string; business: Business | null; error: string }>(),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (uid)
      repository.get(uid).then(
        (business) => {
          if (active) setResult({ uid, business, error: '' });
        },
        (cause) => {
          if (active) setResult({ uid, business: null, error: errorMessage(cause) });
        },
      );
    return () => {
      active = false;
    };
  }, [uid, repository, revision]);
  const current = result?.uid === uid ? result : undefined;
  return (
    <BusinessContext
      value={{
        business: current?.business ?? null,
        status: !uid ? 'ready' : !current ? 'loading' : current.error ? 'error' : 'ready',
        error: current?.error ?? '',
        refresh: () => setRevision((value) => value + 1),
        update: (business) => {
          if (uid && business.ownerUid === uid)
            setResult((previous) =>
              previous && previous.uid !== uid ? previous : { uid, business, error: '' },
            );
        },
      }}
    >
      {children}
    </BusinessContext>
  );
}
