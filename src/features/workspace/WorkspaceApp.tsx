import { lazy, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { confirmDiscardChanges, useDraftProtection } from "./navigation";
import { DeferredScreen } from "../../app/DeferredScreen";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router";
import { useAuth } from "../auth/auth-context";
import { AuthPage } from "../auth/AuthPage";
import { useOnline } from "../../shared/hooks/useOnline";
import type {
  CommandResult,
  WorkspaceAction,
  WorkspaceBusiness,
  WorkspaceCommand,
} from "../../../shared/workspace/model";
import { validateWorkspaceCommand } from "../../../shared/workspace/validation";
import { industryLabel } from "../../../shared/workspace/catalog";
import type { NewBusiness, WorkspaceRepository } from "./WorkspaceRepository";
import { operationJournal } from "./OperationJournal";
import type { SavedRequest } from "./OperationJournal";
import { WorkspaceContext } from "./context";
import BusinessWizard from "./BusinessWizard";
import "./workspace.css";
const WorkspaceHome = lazy(() => import("./WorkspaceHome"));
const definite = (cause: unknown) =>
  !!cause &&
  typeof cause === "object" &&
  "code" in cause &&
  [
    "functions/failed-precondition",
    "functions/invalid-argument",
    "functions/permission-denied",
    "functions/unauthenticated",
    "functions/not-found",
  ].includes(String(cause.code));
const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la solicitud.";

export function WorkspaceApp({
  repository,
}: {
  repository: WorkspaceRepository;
}) {
  const { user, status, service, error: authError } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  useDraftProtection();
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <div className="environment-banner">
        {import.meta.env.VITE_USE_EMULATORS === "false"
          ? "Beta de KhypuPyme · Servicio alojado"
          : "Entorno local de pruebas · Usa datos ficticios"}
      </div>
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            KhypuPyme
          </Link>
          <div className="header-actions">
            <span className="version-label">0.4 beta 2</span>
            {user && (
              <button
                onClick={() => {
                  if (!confirmDiscardChanges()) return;
                  void service
                    .logout()
                    .catch((e) => setLogoutError(message(e)));
                }}
              >
                <Icon name="logout" />
                Salir
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        {logoutError && (
          <p role="alert" className="notice notice-error">
            {logoutError}
          </p>
        )}
        {status === "loading" ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : status === "error" ? (
          <p role="alert">{authError}</p>
        ) : (
          <Routes>
            <Route path="/ingresar" element={<AuthPage mode="login" />} />
            <Route path="/registro" element={<AuthPage mode="register" />} />
            <Route path="/recuperar" element={<AuthPage mode="reset" />} />
            <Route
              path="/*"
              element={
                user ? (
                  <Account
                    key={user.uid}
                    uid={user.uid}
                    repository={repository}
                  />
                ) : (
                  <Navigate to="/ingresar" replace />
                )
              }
            />
          </Routes>
        )}
      </main>
    </>
  );
}
function Account({
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
    attempting = useRef(false);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const page = await repository.businesses();
    setBusinesses(page.items);
    setNext(page.next);
    return page;
  }, [repository]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const page = await load(),
          saved = await operationJournal.get(uid, "new");
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
    };
  }, [uid, repository, load]);
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
      if (!retry) {
        if (await operationJournal.get(uid, "new"))
          throw new Error("Resuelve primero la creación pendiente.");
        await operationJournal.save(uid, "new", input, true);
      }
      setPending((await operationJournal.get(uid, "new")) ?? null);
      const result = await repository.create(input);
      await operationJournal.clear(uid, "new");
      setPending(null);
      await load();
      await select(result);
    } catch (e) {
      if (definite(e)) {
        await operationJournal.clear(uid, "new");
        setPending(null);
      }
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
                  const result = await repository.creationStatus(
                    pending.request as NewBusiness,
                  );
                  if (result) {
                    await operationJournal.clear(uid, "new");
                    setPending(null);
                    await load();
                    await select(result);
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
function Workspace({
  uid,
  business,
  repository,
  onExit,
  onBusiness,
}: {
  uid: string;
  business: WorkspaceBusiness;
  repository: WorkspaceRepository;
  onExit: () => void;
  onBusiness: (b: WorkspaceBusiness) => void;
}) {
  const online = useOnline(),
    [pending, setPending] = useState<SavedRequest | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [canRetry, setCanRetry] = useState(false),
    attempting = useRef(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let saved = await operationJournal.get(uid, business.id);
        if (!saved && business.id === uid) {
          for (const source of ["inventory", "commerce"] as const) {
            const key = `khypupyme:pending-${source}:${uid}`,
              raw = sessionStorage.getItem(key);
            if (raw) {
              const original = JSON.parse(raw),
                operationId =
                  source === "inventory" ? original.id : original.operationId;
              const request = {
                apiVersion: 2,
                businessId: business.id,
                operationId,
                kind: "recover-legacy",
                input: { source, request: original },
              } as WorkspaceCommand;
              await operationJournal.save(uid, business.id, request);
              saved = await operationJournal.get(uid, business.id);
              break;
            }
          }
        }
        if (active) {
          setPending(saved ?? null);
          setReady(true);
        }
      } catch (e) {
        if (active) setError(message(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, business.id, revision]);
  async function confirmed(result: CommandResult, command: WorkspaceCommand) {
    await operationJournal.clear(uid, business.id);
    if (command.kind === "recover-legacy")
      sessionStorage.removeItem(
        `khypupyme:pending-${command.input.source}:${uid}`,
      );
    setPending(null);
    setCanRetry(false);
    setNotice(result.message);
    setRevision((r) => r + 1);
    if (command.kind === "confirm-type" || command.kind === "preferences")
      onBusiness(await repository.business(business.id));
  }
  async function execute(
    command: WorkspaceCommand,
    retry = false,
  ): Promise<CommandResult | undefined> {
    if (attempting.current) return;
    attempting.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!online) throw new Error("Recupera la conexión para continuar.");
      const normalized = validateWorkspaceCommand(command);
      if (!retry) {
        if (await operationJournal.get(uid, business.id))
          throw new Error("Resuelve primero la solicitud pendiente.");
        await operationJournal.save(uid, business.id, normalized);
      }
      setPending((await operationJournal.get(uid, business.id)) ?? null);
      const result = await repository.execute(normalized);
      await confirmed(result, normalized);
      return result;
    } catch (e) {
      if (definite(e)) {
        await operationJournal.clear(uid, business.id);
        setPending(null);
      }
      setError(message(e));
      throw e;
    } finally {
      attempting.current = false;
      setBusy(false);
    }
  }
  async function run(
    action: WorkspaceAction,
    operationId: string = crypto.randomUUID(),
  ) {
    return execute({
      ...action,
      apiVersion: 2,
      businessId: business.id,
      operationId,
    });
  }
  async function resolve() {
    setBusy(true);
    setError("");
    try {
      const command = pending!.request as WorkspaceCommand,
        result = await repository.status(command);
      if (result) await confirmed(result, command);
      else {
        setCanRetry(true);
        setNotice(
          "El servidor no tiene una confirmación. Reintenta manualmente la solicitud original.",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceContext
      value={{
        business,
        repository,
        revision,
        busy: busy || !!pending || !online || !ready,
        run,
      }}
    >
      <div
        className="business-workspace"
        data-industry={business.industryId ?? "general"}
      >
        <span className="active-business-label" title={business.name}>
          <span className="sr-only">Negocio activo: </span>
          {business.name}
        </span>
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">NEGOCIO ACTIVO</span>
            <h1>{business.name}</h1>
            <p>{industryLabel(business.industryId)}</p>
          </div>
          <div className="workspace-status">
            <span className="connection" data-online={online}>
              <span className="connection-dot" />
              {online ? "Con conexión" : "Sin conexión"}
            </span>
            <button
              onClick={() => {
                if (confirmDiscardChanges()) onExit();
              }}
            >
              <Icon name="grid" />
              Cambiar negocio
            </button>
          </div>
        </div>
        {!online && (
          <p role="alert">
            Sin conexión. No se guardan operaciones ni se reenvían
            automáticamente.
          </p>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            <Icon name="check" />
            {notice}
          </p>
        )}
        {pending && (
          <section className="notice notice-warning pending-request">
            <div>
              <h2>Solicitud pendiente en este negocio</h2>
              <p>Resultado sin confirmar · {business.name}</p>
              <p>
                Se conserva el contenido original. Consulta antes de volver a
                enviarlo.
              </p>
              <button
                disabled={busy || !online}
                onClick={() => {
                  void resolve();
                }}
              >
                Consultar confirmación
              </button>
              {canRetry && (
                <button
                  disabled={busy || !online}
                  onClick={() => {
                    void execute(
                      pending.request as WorkspaceCommand,
                      true,
                    ).catch(() => {});
                  }}
                >
                  Reintentar solicitud original
                </button>
              )}
            </div>
          </section>
        )}
        {!ready ? (
          <p role="status">Recuperando solicitudes…</p>
        ) : !business.typeConfirmed ? (
          <BusinessWizard
            initialName={business.name}
            initialIndustry={business.industryId}
            busy={busy || !!pending}
            onConfirm={(_, industryId, answers) =>
              run({ kind: "confirm-type", input: { industryId, answers } })
            }
          />
        ) : (
          <DeferredScreen>
            <WorkspaceHome />
          </DeferredScreen>
        )}
      </div>
    </WorkspaceContext>
  );
}
