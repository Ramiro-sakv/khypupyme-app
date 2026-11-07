import { canonical } from "../../../shared/commerce";
import type {
  CommandResult,
  WorkspaceAction,
  WorkspaceCommand,
} from "../../../shared/workspace/model";
import { validateWorkspaceCommand } from "../../../shared/workspace/validation";
import type { PendingRequestStore } from "./PendingRequestStore";
import type { WorkspaceRepository } from "./WorkspaceRepository";
export interface WorkspaceIdentity {
  readonly uid: string;
  readonly businessId: string;
}
export interface CommandConfirmation {
  command: WorkspaceCommand;
  result: CommandResult;
}
export function definitiveFailure(cause: unknown) {
  return (
    !!cause &&
    typeof cause === "object" &&
    "code" in cause &&
    [
      "functions/failed-precondition",
      "functions/invalid-argument",
      "functions/permission-denied",
      "functions/unauthenticated",
      "functions/not-found",
    ].includes(String(cause.code))
  );
}
export class WorkspaceCommandService {
  private locked = false;
  readonly context: WorkspaceIdentity;
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly journal: PendingRequestStore,
    context: WorkspaceIdentity,
  ) {
    this.context = Object.freeze({ ...context });
  }
  private normalize(raw: WorkspaceCommand) {
    const command = validateWorkspaceCommand(raw);
    if (command.businessId !== this.context.businessId)
      throw new Error("La solicitud pertenece a otro negocio.");
    return command;
  }
  async pending() {
    const { uid, businessId } = this.context;
    return this.journal.get(uid, businessId);
  }
  async restore() {
    const { uid, businessId } = this.context;
    let saved = await this.pending();
    if (!saved && uid === businessId) {
      for (const source of ["inventory", "commerce"] as const) {
        const raw = sessionStorage.getItem(
          `khypupyme:pending-${source}:${uid}`,
        );
        if (!raw) continue;
        const original = JSON.parse(raw);
        const command = this.normalize({
          apiVersion: 2,
          businessId,
          operationId:
            source === "inventory" ? original.id : original.operationId,
          kind: "recover-legacy",
          input: { source, request: original },
        });
        await this.journal.save(uid, businessId, command);
        saved = await this.pending();
        break;
      }
    }
    return saved;
  }
  prepare(action: WorkspaceAction, operationId: string = crypto.randomUUID()) {
    return this.normalize({
      ...action,
      apiVersion: 2,
      businessId: this.context.businessId,
      operationId,
    });
  }
  private async acknowledge(
    command: WorkspaceCommand,
    result: CommandResult,
  ): Promise<CommandConfirmation> {
    await this.journal.clear(
      this.context.uid,
      this.context.businessId,
      command,
    );
    if (command.kind === "recover-legacy")
      sessionStorage.removeItem(
        `khypupyme:pending-${command.input.source}:${this.context.uid}`,
      );
    return { command, result };
  }
  async send(raw: WorkspaceCommand): Promise<CommandConfirmation> {
    const command = this.normalize(raw);
    if (this.locked) throw new Error("Ya hay una solicitud en curso.");
    this.locked = true;
    let own = false;
    try {
      if (!navigator.onLine)
        throw new Error("Recupera la conexión para continuar.");
      if (await this.pending())
        throw new Error("Resuelve primero la solicitud pendiente.");
      await this.journal.save(
        this.context.uid,
        this.context.businessId,
        command,
      );
      own = true;
      return await this.acknowledge(
        command,
        await this.repository.execute(command),
      );
    } catch (cause) {
      if (own && definitiveFailure(cause))
        await this.journal.clear(
          this.context.uid,
          this.context.businessId,
          command,
        );
      throw cause;
    } finally {
      this.locked = false;
    }
  }
  async adopt(raw: WorkspaceCommand) {
    const command = this.normalize(raw),
      saved = await this.pending();
    if (saved) {
      if (canonical(saved.request) !== canonical(command))
        throw new Error("Resuelve primero la otra solicitud pendiente.");
    } else
      await this.journal.save(
        this.context.uid,
        this.context.businessId,
        command,
      );
  }
  async check(): Promise<CommandConfirmation | null> {
    if (this.locked)
      throw new Error("Espera a que termine la solicitud actual.");
    this.locked = true;
    try {
      const saved = await this.pending();
      if (!saved || saved.creation)
        throw new Error("No hay una solicitud comercial pendiente.");
      const command = this.normalize(saved.request as WorkspaceCommand),
        result = await this.repository.status(command);
      return result ? await this.acknowledge(command, result) : null;
    } finally {
      this.locked = false;
    }
  }
  async retry(raw: WorkspaceCommand): Promise<CommandConfirmation> {
    const command = this.normalize(raw);
    if (this.locked) throw new Error("Ya hay una solicitud en curso.");
    this.locked = true;
    let own = false;
    try {
      if (!navigator.onLine)
        throw new Error("Recupera la conexión para continuar.");
      const saved = await this.pending();
      if (!saved || canonical(saved.request) !== canonical(command))
        throw new Error("Conserva la solicitud pendiente original.");
      own = true;
      const confirmed = await this.repository.status(command);
      return await this.acknowledge(
        command,
        confirmed ?? (await this.repository.execute(command)),
      );
    } catch (cause) {
      if (own && definitiveFailure(cause))
        await this.journal.clear(
          this.context.uid,
          this.context.businessId,
          command,
        );
      throw cause;
    } finally {
      this.locked = false;
    }
  }
}
