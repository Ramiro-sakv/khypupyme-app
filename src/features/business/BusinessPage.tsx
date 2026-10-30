import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { businessName } from './domain';
import type { Business, BusinessRepository } from './domain';
import { errorMessage } from '../../shared/errors';
import { Feedback } from '../../shared/components/Feedback';
import { useOnline } from '../../shared/hooks/useOnline';

export function BusinessPage({ repository, settings = false }: { repository: BusinessRepository; settings?: boolean }) {
  const { user } = useAuth();
  const online = useOnline();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (user) repository.get(user.uid).then(
      (result) => { if (active) { setBusiness(result); setLoading(false); setLoadFailed(false); setError(''); } },
      (cause) => { if (active) { setError(errorMessage(cause)); setLoadFailed(true); setLoading(false); } },
    );
    return () => { active = false; };
  }, [repository, user, attempt]);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || !user) return;
    let name: string;
    try { name = businessName(String(new FormData(event.currentTarget).get('name') ?? '')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa el nombre.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await (business ? repository.rename(user.uid, name) : repository.create(user.uid, name));
      setBusiness(result); setMessage('Tu negocio se guardó correctamente.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status">Consultando tu negocio…</p>;
  if (loadFailed) return <section className="card"><h1>No pudimos consultar tu negocio</h1><Feedback error={error} /><button onClick={() => { setLoading(true); setAttempt(attempt + 1); }} disabled={!online}>Volver a consultar</button></section>;
  return <>
    <div className="page-heading"><span className="eyebrow">MI NEGOCIO</span><h1>{business ? (settings ? 'Perfil de tu negocio' : `Hola, ${business.name}`) : 'Dale un nombre a tu negocio'}</h1><p>{business ? 'Tu espacio está listo. Vamos a construirlo contigo.' : 'Solo necesitamos lo esencial para comenzar.'}</p></div>
    <div className="workspace-grid">
      <section className="card"><div className="section-label">01 / TU PERFIL</div><h2>{business ? 'Datos del negocio' : 'Crea tu negocio'}</h2>
        <form onSubmit={save} aria-busy={busy} key={business?.id ?? 'new'}>
          <label htmlFor="name">Nombre del negocio</label><input id="name" name="name" defaultValue={business?.name ?? ''} minLength={2} maxLength={80} required autoComplete="organization" />
          <div className="details"><div><span>Moneda</span><strong>Bolivianos · BOB</strong></div><div><span>Zona horaria</span><strong>Bolivia · La Paz</strong></div></div>
          <p className="muted">El perfil pertenece únicamente a tu cuenta.</p><Feedback error={error} message={message} />
          <button className="primary" disabled={busy || !online}>{busy ? 'Guardando…' : business ? 'Guardar cambios' : 'Crear mi negocio'}</button>
        </form>
      </section>
      <aside className="next-card"><span className="section-label">02 / LO QUE SIGUE</span><h2>Primero, una base firme.</h2><p>Tu cuenta y el perfil ya tienen su lugar. Las herramientas del día a día se habilitarán después de revisar esta primera etapa.</p>
        <ul className="module-list">{['Ventas y gastos', 'Productos y existencias', 'Fiados y cobros', 'Resumen y reportes'].map((name) => <li key={name}><span>{name}</span><span className="tag">Próximamente</span></li>)}</ul>
        <p className="muted">Todavía no se registran operaciones comerciales.</p>
      </aside>
    </div>
  </>;
}
