import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/auth-context';
import type { Business, BusinessRepository } from '../business/domain';
import { BusinessPage } from '../business/BusinessPage';
import { Feedback } from '../../shared/components/Feedback';
import { errorMessage } from '../../shared/errors';

export function CommerceArea({
  repository,
  children,
}: {
  repository: BusinessRepository;
  children: (business: Business, uid: string) => ReactNode;
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<{ business: Business | null; error: string }>(),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (user)
      repository.get(user.uid).then(
        (business) => {
          if (active) setResult({ business, error: '' });
        },
        (cause) => {
          if (active) setResult({ business: null, error: errorMessage(cause) });
        },
      );
    return () => {
      active = false;
    };
  }, [user, repository, retry]);
  if (!result) return <p role="status">Consultando tu negocio…</p>;
  if (result.error)
    return (
      <section className="card">
        <Feedback error={result.error} />
        <button onClick={() => setRetry(retry + 1)}>Volver a consultar</button>
      </section>
    );
  if (!result.business)
    return (
      <BusinessPage
        repository={repository}
        onReady={(business) => setResult({ business, error: '' })}
      />
    );
  return children(result.business, user!.uid);
}
