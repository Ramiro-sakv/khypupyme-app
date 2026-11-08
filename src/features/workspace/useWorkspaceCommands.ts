import { errorMessage } from "../../shared/errors";
import { useEffect, useRef, useState } from "react";
import type {
  WorkspaceAction,
  WorkspaceBusiness,
  WorkspaceCommand,
} from "../../../shared/workspace/model";
import { definitiveFailure } from "./WorkspaceCommandService";
import { draftRepository } from "./IndexedDbDraftRepository";
import type { SavedRequest } from "./OperationJournal";
import type {
  CommandConfirmation,
  WorkspaceCommandService,
} from "./WorkspaceCommandService";
export function useWorkspaceCommands(
  service: WorkspaceCommandService,
  repository: { business: (id: string) => Promise<WorkspaceBusiness> },
  onBusiness: (business: WorkspaceBusiness) => void,
) {
  const [pending, setPending] = useState<SavedRequest | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [canRetry, setCanRetry] = useState(false),
    [confirmedOperationId, setConfirmedOperationId] = useState(""),
    [rejectedOperationId, setRejectedOperationId] = useState(""),
    alive = useRef(true);
  const message = (e: unknown) =>
    errorMessage(e, "No se pudo completar la solicitud.");
  useEffect(() => {
    let active = true;
    alive.current = true;
    service
      .restore()
      .then((saved) => {
        if (active) {
          setPending(saved ?? null);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [service, revision]);
  async function confirmed(receipt: CommandConfirmation) {
    const { command, result } = receipt;
    let cleanup = "";
    try {
      await draftRepository.removeLinked(service.context, command.operationId);
    } catch {
      cleanup =
        " La operación se confirmó; el borrador local no pudo limpiarse. Consulta su estado antes de restaurarlo.";
    }
    if (!alive.current) return;
    setPending(null);
    setConfirmedOperationId(command.operationId);
    setCanRetry(false);
    setNotice(result.message + cleanup);
    setRevision((n) => n + 1);
    if (
      command.kind === "confirm-type" ||
      command.kind === "preferences" ||
      command.kind === "timber-preferences"
    ) {
      try {
        const business = await repository.business(service.context.businessId);
        if (alive.current) onBusiness(business);
      } catch (e) {
        if (alive.current)
          setError("La operación está confirmada. " + message(e));
      }
    }
  }
  async function perform(
    task: () => Promise<CommandConfirmation | null>,
    command?: WorkspaceCommand,
  ) {
    let attempted = command;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!attempted) {
        const saved = await service.pending();
        if (saved && !saved.creation)
          attempted = saved.request as WorkspaceCommand;
      }
      const receipt = await task();
      if (receipt) {
        await confirmed(receipt);
        return receipt.result;
      }
      if (alive.current) {
        setCanRetry(true);
        setNotice(
          "El servidor no tiene una confirmación. Puedes reintentar manualmente la solicitud original.",
        );
      }
    } catch (e) {
      if (alive.current) {
        setError(message(e));
        if (attempted && definitiveFailure(e))
          setRejectedOperationId(attempted.operationId);
      }
      throw e;
    } finally {
      try {
        const saved = await service.pending();
        if (alive.current) setPending(saved ?? null);
      } catch (e) {
        if (alive.current) setError(message(e));
      }
      if (alive.current) setBusy(false);
    }
  }
  return {
    pending,
    ready,
    busy,
    error,
    notice,
    revision,
    canRetry,
    confirmedOperationId,
    rejectedOperationId,
    run: (action: WorkspaceAction, id?: string) => {
      const command = service.prepare(action, id);
      return perform(() => service.send(command), command);
    },
    prepare: (action: WorkspaceAction, id?: string) =>
      service.prepare(action, id),
    async recover(command: CommandConfirmation["command"]) {
      await service.adopt(command);
      if (alive.current) {
        setPending((await service.pending()) ?? null);
        setCanRetry(false);
        setRevision((n) => n + 1);
      }
    },
    resolve: () => perform(() => service.check()),
    retry: () =>
      perform(async () => {
        const saved = await service.pending();
        if (!saved || saved.creation)
          throw new Error("No hay una solicitud comercial pendiente.");
        return service.retry(saved.request as CommandConfirmation["command"]);
      }),
  };
}
