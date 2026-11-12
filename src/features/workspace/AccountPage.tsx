import { errorMessage } from "../../shared/errors";
import { resetLocalWorkspace } from "./resetLocalWorkspace";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { industryLabel } from "../../../shared/workspace/catalog";
import type { WorkspaceBusiness } from "../../../shared/workspace/model";
import { AccountCreationService } from "./AccountCreationService";
import AccountSessionActions from "./AccountSessionActions";
import BusinessWizard from "./BusinessWizard";
import type { DeletionJob } from "../../../shared/workspace/business-deletion";
import { finishBusinessDeletion } from "./businessDeletion";
import { industryIcon, industryStyle } from "./industryAppearance";
import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";
import type { SavedRequest } from "./OperationJournal";
import { operationJournal } from "./OperationJournal";
import type { NewBusiness, WorkspaceRepository } from "./WorkspaceRepository";
import Workspace from "./Workspace";
const message = (e: unknown) =>
  errorMessage(e, "No se pudo completar la solicitud.");

export default function Account({
  uid,
  repository,
}: {
  uid: string;
  repository: WorkspaceRepository;
}) {
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([]),
    [deletions, setDeletions] = useState<DeletionJob[]>([]),
    [deleting, setDeleting] = useState(""),
    [notice, setNotice] = useState(""),
    [recentId, setRecentId] = useState(() => localStorage.getItem(`khypupyme:last-business:${uid}`)),
    [recentBusiness, setRecentBusiness] = useState<WorkspaceBusiness | null>(null),
    [next, setNext] = useState<string | null>(null),
    [business, setBusiness] = useState<WorkspaceBusiness | null>(null),
    [create, setCreate] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [pending, setPending] = useState<SavedRequest | null>(null),
    [busy, setBusy] = useState(false),
    [creationRetry, setCreationRetry] = useState(false),
    attempting = useRef(false),
    mounted = useRef(true);
  const navigate = useNavigate(),
    creationService = useMemo(
      () => new AccountCreationService(repository, operationJournal, uid),
      [repository, uid],
    );
  const load = useCallback(async () => {
    const page = await repository.businesses();
    await resetLocalWorkspace(uid, page.reset);
    setBusinesses(page.items);
    setDeletions(page.deletions ?? []);
    setRecentId(localStorage.getItem(`khypupyme:last-business:${uid}`));
    setNext(page.next);
    return page;
  }, [repository, uid]);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    (async () => {
      try {
        const page = await load(),
          saved = await creationService.pending();
        if (!active) return;
        setPending(saved ?? null);
        const id = localStorage.getItem(`khypupyme:last-business:${uid}`);
        if (id) {
          try {
            const selected =
              page.items.find((b) => b.id === id) ??
              (await repository.business(id));
            if (active) setBusiness(selected);
          } catch (e) {
            if (active) setLoadError(errorMessage(e, "No se pudo recuperar el último negocio. Revisa la conexión y la fecha del respaldo en la terminal."));
          }
        }
      } catch (e) {
        if (active) setLoadError(errorMessage(e, "No se pudieron cargar tus negocios. Comprueba que KhypuPyme indique que los emuladores están listos en la terminal."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [uid, repository, load, creationService, reload]);
  async function select(b: WorkspaceBusiness) {
    setBusiness(b);
    setCreate(false);
    localStorage.setItem(`khypupyme:last-business:${uid}`, b.id);
    setRecentId(b.id);
    navigate("/");
  }
  async function continueDeletion(id: string) {
    if (attempting.current || !repository.deletion) return;
    attempting.current = true;
    setDeleting(id);
    setNotice("");
    setError("");
    try {
      const reset = await finishBusinessDeletion(repository.deletion.bind(repository), id, () => mounted.current);
      if (reset) {
        await resetLocalWorkspace(uid, reset);
        await load();
        setNotice("Negocio eliminado.");
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      attempting.current = false;
      setDeleting("");
    }
  }
  async function createBusiness(input: NewBusiness, retry = false) {
    if (attempting.current) return;
    attempting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await creationService.create(input, retry);
      if (!mounted.current) return;
      setPending(null);
      await load();
      if (mounted.current) await select(result);
    } catch (e) {
      setPending((await creationService.pending()) ?? null);
      setError(message(e));
    } finally {
      attempting.current = false;
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Cargando tus negocios…</p>;
  if (business)
    return (
      <Workspace
        key={business.id}
        uid={uid}
        business={business}
        repository={repository}
        onBusiness={setBusiness}
        onExit={() => {
          const id = localStorage.getItem(`khypupyme:last-business:${uid}`);
          setRecentId(id);
          setRecentBusiness(id === business.id ? business : null);
          setBusiness(null);
          navigate("/");
          void load().catch((cause) => setLoadError(message(cause)));
        }}
      />
    );
  const recent = businesses.find((entry) => entry.id === recentId)
    ?? (recentBusiness?.id === recentId ? recentBusiness : null);
  return (
    <>
      <header className="selector-heading directory-header">
        <div>
          <h1>Mis negocios</h1>
          <p>Elige el negocio con el que vas a trabajar.</p>
        </div>
        <div className="selector-actions">
          {!create && <button className="primary" disabled={!!pending || !!loadError} onClick={() => setCreate(true)}>
            <Icon name="plus" /> Crear negocio
          </button>}
          <AccountSessionActions />
        </div>
      </header>
      {notice && <p className="notice notice-info" role="status">{notice}</p>}
      {deletions.length > 0 && <section className="card">
        <h2>Borrados pendientes</h2>
        <ul className="record-list">
          {deletions.map((job) => <li key={job.businessId} className="section-heading">
            <strong>{job.name}</strong>
            <button disabled={!!deleting} onClick={() => void continueDeletion(job.businessId)}>
              {deleting === job.businessId ? "Eliminando registros…" : "Continuar borrado"}
            </button>
          </li>)}
        </ul>
      </section>}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {loadError && <div className="notice notice-error" role="alert">
        <p>{loadError}</p>
        <button onClick={() => { setLoadError(""); setLoading(true); setReload((value) => value + 1); }}>Volver a cargar negocios</button>
      </div>}
      {pending && (
        <section className="card">
          <h2>Creación sin confirmar</h2>
          <p>Conservamos la configuración original en este dispositivo.</p>
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                try {
                  const result = await creationService.check();
                  if (!mounted.current) return;
                  if (result) {
                    setPending(null);
                    await load();
                    if (mounted.current) await select(result);
                  } else {
                    setCreationRetry(true);
                    setError(
                      "La creación no está confirmada. Puedes reintentar con la misma configuración.",
                    );
                  }
                } catch (e) {
                  setError(message(e));
                }
              })();
            }}
          >
            Consultar estado
          </button>
          <button
            disabled={busy || !creationRetry}
            onClick={() => {
              void createBusiness(pending.request as NewBusiness, true);
            }}
          >
            Reintentar creación original
          </button>
        </section>
      )}
      {create ? (
        <BusinessWizard
          busy={busy || !!pending}
          onCancel={() => {
            if (confirmDiscardChanges()) setCreate(false);
          }}
          onConfirm={(name, industryId, answers) =>
            createBusiness({
              operationId: crypto.randomUUID(),
              name,
              industryId,
              answers,
            })
          }
        />
      ) : (
        <>
          {recent && <button className="card business-choice recent-business"
            data-industry={recent.industryId ?? "general"} style={industryStyle(recent.industryId)}
            onClick={() => { void select(recent); }}>
            <span className="business-symbol"><Icon name={industryIcon(recent.industryId)} /></span>
            <span className="business-choice-label">
              <small>Último negocio utilizado</small>
              <strong>{recent.name}</strong>
              <span>{industryLabel(recent.industryId)}</span>
            </span>
            <Icon name="arrow" />
          </button>}
          <div className="business-directory">
            {businesses.filter((b) => b.id !== recent?.id).map((b) => (
              <button
                className="card business-choice"
                data-industry={b.industryId ?? "general"}
                style={industryStyle(b.industryId)}
                key={b.id}
                onClick={() => {
                  void select(b);
                }}
              >
                <span className="business-symbol"><Icon name={industryIcon(b.industryId)} /></span>
                <span className="business-choice-label">
                  <strong>{b.name}</strong>
                  <span>{industryLabel(b.industryId)}</span>

                </span>
                <Icon name="arrow" />
              </button>
            ))}
            {!businesses.length && !recent && !loadError && <section className="card business-directory-empty">
              <Icon name="grid" />
              <h2>Tu primer negocio</h2>
              <p>Elige un rubro para configurar sus productos, ventas y caja.</p>
              <button type="button" disabled={!!pending} onClick={() => setCreate(true)}>Crear negocio</button>
            </section>}
          </div>
          {next && (
            <button
              onClick={() => {
                void repository
                  .businesses(next)
                  .then((p) => {
                    setBusinesses((old) => [...old, ...p.items]);
                    setNext(p.next);
                  })
                  .catch((e) => setError(message(e)));
              }}
            >
              Más negocios
            </button>
          )}

        </>
      )}
    </>
  );
}
