import { resetLocalWorkspace } from "./resetLocalWorkspace";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { industryLabel } from "../../../shared/workspace/catalog";
import type { WorkspaceBusiness } from "../../../shared/workspace/model";
import { AccountCreationService } from "./AccountCreationService";
import BusinessWizard from "./BusinessWizard";
import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";
import type { SavedRequest } from "./OperationJournal";
import { operationJournal } from "./OperationJournal";
import type { NewBusiness, WorkspaceRepository } from "./WorkspaceRepository";
import Workspace from "./Workspace";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la solicitud.";

export default function Account({
  uid,
  repository,
}: {
  uid: string;
  repository: WorkspaceRepository;
}) {
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([]),
    [next, setNext] = useState<string | null>(null),
    [business, setBusiness] = useState<WorkspaceBusiness | null>(null),
    [create, setCreate] = useState(false),
    [loading, setLoading] = useState(true),
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
          } catch {
            localStorage.removeItem(`khypupyme:last-business:${uid}`);
          }
        }
      } catch (e) {
        if (active) setError(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [uid, repository, load, creationService]);
  async function select(b: WorkspaceBusiness) {
    setBusiness(b);
    setCreate(false);
    localStorage.setItem(`khypupyme:last-business:${uid}`, b.id);
    navigate("/");
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
          setBusiness(null);
          navigate("/");
        }}
      />
    );
  return (
    <>
      <div className="selector-heading">
        <span className="eyebrow">TUS ESPACIOS DE TRABAJO</span>
        <h1>¿Con qué negocio empezamos?</h1>
        <p>
          Una cuenta, espacios independientes. Selecciona el que vas a
          administrar.
        </p>
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
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
          <div className="workspace-grid">
            {businesses.map((b) => (
              <button
                className="card business-choice"
                key={b.id}
                onClick={() => {
                  void select(b);
                }}
              >
                <span className="business-symbol">
                  <Icon name="box" />
                </span>
                <strong>{b.name}</strong>
                <span>{industryLabel(b.industryId)}</span>
                <span className="choice-footer">
                  Abrir negocio
                  <Icon name="arrow" />
                </span>
              </button>
            ))}
            <button
              className="card business-choice new-business"
              disabled={!!pending}
              onClick={() => setCreate(true)}
            >
              <span className="business-symbol">
                <Icon name="plus" />
              </span>
              <strong>Crear otro negocio</strong>
              <span>Tu misma cuenta. Un espacio independiente.</span>
            </button>
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
          <button
            className="primary"
            disabled={!!pending}
            onClick={() => setCreate(true)}
          >
            Crear otro negocio
          </button>
        </>
      )}
    </>
  );
}
