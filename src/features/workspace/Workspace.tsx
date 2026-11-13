import TimberTutorialHost from "./tutorial/TimberTutorialHost";
import TutorialCoach from "./tutorial/TutorialCoach";
import { CashStateProvider } from "./CashState";
import { lazy, useMemo } from "react";
import { industryLabel } from "../../../shared/workspace/catalog";
import type { WorkspaceBusiness } from "../../../shared/workspace/model";
import { DeferredScreen } from "../../app/DeferredScreen";
import { useOnline } from "../../shared/hooks/useOnline";
import BusinessWizard from "./BusinessWizard";
import { Icon } from "./Icon";
import { industryIcon, industryStyle } from "./industryAppearance";
import { useWorkspaceNavigation } from "./navigation";
import { operationJournal } from "./OperationJournal";
import { WorkspaceCommandService } from "./WorkspaceCommandService";
import type { WorkspaceRepository } from "./WorkspaceRepository";
import { WorkspaceContext } from "./context";
import { useWorkspaceCommands } from "./useWorkspaceCommands";
import { useCorrectionAuthorization } from "./useCorrectionAuthorization";
import { BusinessPlanBanner } from "../billing/BusinessPlanPanel";
import { useBusinessPlan } from "../billing/useBusinessPlan";
import { AppError } from "../../../shared/app-errors";
import { isBillingEnabled } from "../billing/profile";

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
  const billingEnabled = isBillingEnabled && !business.tutorialSessionId;
  const billing = useBusinessPlan(repository, business.id, billingEnabled);
  const readOnly = billing.plan?.status === "expired" || billing.plan?.status === "trial-available";
  const { view } = useWorkspaceNavigation();
  const dashboard = view === "inicio" && business.typeConfirmed;
  const protection = useCorrectionAuthorization(business, repository);
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
  } = useWorkspaceCommands(commandService, repository, onBusiness, protection.authorize);
  return (
    <WorkspaceContext
      value={{
        identity: commandService.context,
        ...(billingEnabled ? { billing, readOnly } : {}),
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
        run: (action, operationId) => {
          if (readOnly && !["close-cash", "preferences", "timber-preferences", "confirm-type"].includes(action.kind))
            return Promise.reject(new AppError("Renueva el plan de este negocio para registrar operaciones.", 403, "BUSINESS_PLAN_REQUIRED"));
          return run(action, operationId);
        },
      }}
    >
      <CashStateProvider>
        {protection.dialog}
        <div
          className="business-workspace"
          data-industry={business.industryId ?? "general"}
          style={industryStyle(business.industryId)}
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
          <div className="workspace-heading workspace-masthead" data-dashboard={dashboard}>
            {!dashboard && <div className="workspace-masthead-identity">
              <span className="business-symbol"><Icon name={industryIcon(business.industryId)} /></span>
              <div><h1>{business.name}</h1><p>{industryLabel(business.industryId)}</p></div>
            </div>}
            <div className="workspace-status">
              <span className="connection" data-online={online}>
                <span className="connection-dot" />
                {online ? "Con conexión" : "Sin conexión"}
              </span>
            </div>
          </div>
          {dashboard && billingEnabled && <BusinessPlanBanner {...billing} />}
          {!online && (
            <p role="alert">
              Sin conexión. No se guardan operaciones ni se reenvían
              automáticamente. [503]
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
              <WorkspaceHome onExit={onExit} />
            </DeferredScreen>
          )}
        </div>
      </CashStateProvider>
    </WorkspaceContext>
  );
}

export default function Workspace(
  props: Parameters<typeof WorkspaceContent>[0],
) {
  return <TimberTutorialHost {...props} component={WorkspaceContent} />;
}
