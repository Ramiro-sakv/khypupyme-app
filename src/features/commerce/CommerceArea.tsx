import type { ReactNode } from 'react';
import { useAuth } from '../auth/auth-context';
import { useBusiness } from '../business/business-context';
import type { Business, BusinessRepository } from '../business/domain';
import { BusinessPage } from '../business/BusinessPage';
import { Feedback } from '../../shared/components/Feedback';

export function CommerceArea({
  repository,
  children,
}: {
  repository: BusinessRepository;
  children: (business: Business, uid: string) => ReactNode;
}) {
  const { user } = useAuth();
  const { business, status, error, refresh } = useBusiness();
  if (status === 'loading') return <p role="status">Consultando tu negocio…</p>;
  if (status === 'error')
    return (
      <section className="card">
        <Feedback error={error} />
        <button onClick={refresh}>Volver a consultar</button>
      </section>
    );
  return business && user ? children(business, user.uid) : <BusinessPage repository={repository} />;
}
