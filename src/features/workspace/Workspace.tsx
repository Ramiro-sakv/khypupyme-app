import TimberTutorialHost from "./tutorial/TimberTutorialHost";
import TutorialCoach from "./tutorial/TutorialCoach";
import { lazy, useMemo } from "react";
import { industryLabel } from "../../../shared/workspace/catalog";
import type { WorkspaceBusiness } from "../../../shared/workspace/model";
import { DeferredScreen } from "../../app/DeferredScreen";
import { useOnline } from "../../shared/hooks/useOnline";
import BusinessWizard from "./BusinessWizard";
import { Icon } from "./Icon";
import { operationJournal } from "./OperationJournal";
import { WorkspaceCommandService } from "./WorkspaceCommandService";
import type { WorkspaceRepository } from "./WorkspaceRepository";
import { WorkspaceContext } from "./context";
import { confirmDiscardChanges } from "./navigation";
import { useWorkspaceCommands } from "./useWorkspaceCommands";
const WorkspaceHome = lazy(() => import("./WorkspaceHome"));
function WorkspaceContent({
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
    commandService = useMemo(
      () =>
        new WorkspaceCommandService(repository, operationJournal, {
          uid,
          businessId: business.id,
        }),
      [repository, uid, business.id],
    );
  const {
    pending,
    ready,
    busy,
    error,
    notice,
    revision,
    canRetry,
    confirmedOperationId,
    rejectedOperationId,
    run,
    resolve,
    retry,
    prepare,
    recover,
  } = useWorkspaceCommands(commandService, repository, onBusiness);
  return (
    <WorkspaceContext
      value={{
        identity: commandService.context,
        pending: !!pending,
        processing: busy,
        commandError: error,
        canRetryPending: canRetry,
        consultPending: async () => {
          await resolve();
        },
        retryPending: async () => {
          await retry();
        },
        confirmedOperationId,
        rejectedOperationId,
        prepare,
        recover,
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
        {business.tutorialSessionId && (
          <div className="notice sample-banner">
            <strong>PRÁCTICA — DATOS FICTICIOS</strong>
            <span>
              Estos movimientos se borrarán al finalizar. Tu negocio permanece
              separado.
            </span>
          </div>
        )}
        <TutorialCoach />
        {business.sampleData && (
          <div className="notice sample-banner" role="status">
            <strong>NEGOCIO DE EJEMPLO · DATOS FICTICIOS</strong>
            <span>
              Practica aquí. Sus operaciones e informes no son registros reales.
            </span>
          </div>
        )}
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
              disabled={!!business.tutorialSessionId && busy}
              onClick={() => {
                if (confirmDiscardChanges()) onExit();
              }}
            >
              <Icon name="grid" />
              {business.tutorialSessionId
                ? "Pausar y volver al negocio"
                : "Cambiar negocio"}
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
                  void resolve().catch(() => {});
                }}
              >
                Consultar confirmación
              </button>
              {canRetry && (
                <button
                  disabled={busy || !online}
                  onClick={() => {
                    void retry().catch(() => {});
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

export default function Workspace(
  props: Parameters<typeof WorkspaceContent>[0],
) {
  return <TimberTutorialHost {...props} component={WorkspaceContent} />;
}
