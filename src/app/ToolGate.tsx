import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { enabledTools } from '../../shared/business-configuration';
import type { ToolId } from '../../shared/business-configuration';
import { useBusiness } from '../features/business/business-context';
import { useAuth } from '../features/auth/auth-context';
import { usePendingRequests } from '../shared/pendingRequests';
export function ToolGate({ tool, children }: { tool: ToolId | null; children: ReactNode }) {
  const { business, status } = useBusiness();
  const { user } = useAuth();
  const pending = usePendingRequests(user?.uid);
  const recovering = user && (tool === 'inventory' || tool === 'purchases') && pending.inventory;
  if (status === 'loading') return <p role="status">Consultando tus herramientas…</p>;
  if (tool && business && !enabledTools(business).includes(tool) && !recovering)
    return (
      <section className="card">
        <h1>Esta herramienta está desactivada</h1>
        <p>
          Tus registros anteriores se conservan y siguen formando parte de los informes. Puedes
          activar la herramienta desde el perfil del negocio.
        </p>
        <Link className="button primary" to="/negocio">
          Configurar herramientas
        </Link>
      </section>
    );
  return children;
}
