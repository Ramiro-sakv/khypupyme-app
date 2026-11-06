import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { businessName } from './domain';
import type { BusinessRepository } from './domain';
import { errorMessage } from '../../shared/errors';
import { Feedback } from '../../shared/components/Feedback';
import { useOnline } from '../../shared/hooks/useOnline';
import { useBusiness } from './business-context';
import { ProfilePicker } from './ProfilePicker';
import type { BusinessConfiguration } from '../../../shared/business-configuration';

export function BusinessPage({
  repository,
  settings = false,
}: {
  repository: BusinessRepository;
  settings?: boolean;
}) {
  const { user } = useAuth();
  const online = useOnline();
  const { business, status, error: loadError, refresh, update } = useBusiness();
  const [configuration, setConfiguration] = useState<BusinessConfiguration | null>(null);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || !user) return;
    let name: string;
    try {
      name = businessName(String(new FormData(event.currentTarget).get('name') ?? ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa el nombre.');
      return;
    }
    if (!business && !configuration) {
      setError('Elige el tipo de negocio y revisa sus herramientas.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await (business
        ? repository.rename(user.uid, name)
        : repository.create(user.uid, name, configuration!));
      update(result);
      setMessage('Tu negocio se guardó correctamente.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') return <p role="status">Consultando tu negocio…</p>;
  if (status === 'error')
    return (
      <section className="card">
        <h1>No pudimos consultar tu negocio</h1>
        <Feedback error={loadError} />
        <button onClick={refresh} disabled={!online}>
          Volver a consultar
        </button>
      </section>
    );
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">MI NEGOCIO</span>
        <h1>
          {business
            ? settings
              ? 'Perfil de tu negocio'
              : `Hola, ${business.name}`
            : 'Dale un nombre a tu negocio'}
        </h1>
        <p>
          {business
            ? 'Actualiza los datos y las herramientas de tu negocio.'
            : 'Solo necesitamos lo esencial para comenzar.'}
        </p>
      </div>
      <div className="workspace-grid">
        <section className="card">
          <div className="section-label">01 / TU PERFIL</div>
          <h2>{business ? 'Datos del negocio' : 'Crea tu negocio'}</h2>
          <form onSubmit={save} aria-busy={busy} key={business?.id ?? 'new'}>
            <label htmlFor="name">Nombre del negocio</label>
            <input
              id="name"
              name="name"
              defaultValue={business?.name ?? ''}
              minLength={2}
              maxLength={80}
              required
              autoComplete="organization"
            />
            {!business && (
              <ProfilePicker
                value={configuration}
                onChange={setConfiguration}
                disabled={busy || !online}
              />
            )}
            <div className="details">
              <div>
                <span>Moneda</span>
                <strong>Bolivianos · BOB</strong>
              </div>
              <div>
                <span>Zona horaria</span>
                <strong>Bolivia · La Paz</strong>
              </div>
            </div>
            <p className="muted">El perfil pertenece únicamente a tu cuenta.</p>
            <Feedback error={error} message={message} />
            <button className="primary" disabled={busy || !online}>
              {busy ? 'Guardando…' : business ? 'Guardar cambios' : 'Crear mi negocio'}
            </button>
          </form>
        </section>
        <aside className="next-card">
          <span className="section-label">02 / TUS HERRAMIENTAS</span>
          <h2>Tu negocio, conectado.</h2>
          <p>Controla productos, servicios, ventas y cobros desde un mismo lugar.</p>
          {business && (
            <p>
              <Link to="/inventario">Abrir inventario</Link>
            </p>
          )}
          <ul className="module-list">
            {[
              ['Ventas y gastos', '/ventas'],
              ['Fiados y cobros', '/fiados'],
              ['Resumen e informes', '/informes'],
            ].map(([name, path]) => (
              <li key={name}>
                <Link to={path!}>{name}</Link>
                <span className="tag">Beta</span>
              </li>
            ))}
          </ul>
          <p className="muted">Prueba local: usa únicamente información ficticia.</p>
        </aside>
      </div>
    </>
  );
}
