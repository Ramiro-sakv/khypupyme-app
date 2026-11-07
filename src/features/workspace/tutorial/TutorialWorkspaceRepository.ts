import type {
  WorkspaceRepository,
  Page,
  NewBusiness,
} from "../WorkspaceRepository";
import type {
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
} from "../../../../shared/workspace/model";
import type {
  TutorialReply,
  TutorialRequest,
  TutorialState,
} from "../../../../shared/workspace/timber-tutorial";
export class TutorialWorkspaceRepository implements WorkspaceRepository {
  private listeners = new Set<(state: TutorialState) => void>();
  constructor(
    private readonly transport: (r: TutorialRequest) => Promise<TutorialReply>,
    readonly sourceBusinessId: string,
    readonly sessionId: string,
    readonly practiceBusinessId: string,
  ) {}
  subscribe(listener: (state: TutorialState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private async call(request: TutorialRequest) {
    const reply = await this.transport(request);
    for (const listener of this.listeners) listener(reply.state);
    return reply;
  }
  private same(id: string) {
    if (id !== this.practiceBusinessId)
      throw new Error("El tutorial solo puede usar su espacio temporal.");
  }
  async business(id: string): Promise<WorkspaceBusiness> {
    this.same(id);
    const reply = await this.call({
      action: "business",
      sourceBusinessId: this.sourceBusinessId,
      payload: { sessionId: this.sessionId },
    });
    if (!reply.state.business)
      throw new Error("La práctica ya no está disponible.");
    return reply.state.business;
  }
  async businesses(): Promise<Page<WorkspaceBusiness>> {
    return {
      items: [await this.business(this.practiceBusinessId)],
      next: null,
    };
  }
  create(_input: NewBusiness): Promise<WorkspaceBusiness> {
    void _input;
    return Promise.reject(
      new Error("No se crean negocios desde una práctica."),
    );
  }
  creationStatus(_input: NewBusiness): Promise<WorkspaceBusiness | null> {
    void _input;
    return Promise.reject(
      new Error("Esta práctica no crea cuentas ni negocios permanentes."),
    );
  }
  async execute(command: WorkspaceCommand) {
    this.same(command.businessId);
    const reply = await this.call({
      action: "command",
      sourceBusinessId: this.sourceBusinessId,
      payload: { sessionId: this.sessionId, command },
    });
    if (!reply.result)
      throw new Error(
        "No se recibió confirmación; conserva la solicitud original.",
      );
    return reply.result;
  }
  async status(command: WorkspaceCommand) {
    this.same(command.businessId);
    const reply = await this.call({
      action: "status",
      sourceBusinessId: this.sourceBusinessId,
      payload: { sessionId: this.sessionId, command },
    });
    return reply.result ?? null;
  }
  async list<T>(query: WorkspaceQuery): Promise<Page<T>> {
    this.same(query.businessId);
    const reply = await this.call({
      action: "list",
      sourceBusinessId: this.sourceBusinessId,
      payload: { sessionId: this.sessionId, query },
    });
    if (!reply.page) throw new Error("No se recibió la consulta de práctica.");
    return reply.page as Page<T>;
  }
  async report(businessId: string, from: string, to: string) {
    this.same(businessId);
    const reply = await this.call({
      action: "report",
      sourceBusinessId: this.sourceBusinessId,
      payload: { sessionId: this.sessionId, from, to },
    });
    if (!reply.report) throw new Error("No se recibió el informe de práctica.");
    return reply.report;
  }
}
