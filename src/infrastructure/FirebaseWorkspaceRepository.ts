import type { DeletionRequest, DeletionResult } from "../../shared/workspace/business-deletion";
import type {
  TutorialRequest,
  TutorialReply,
} from "../../shared/workspace/timber-tutorial";
import { httpsCallable } from "firebase/functions";
import type { Functions } from "firebase/functions";
import type {
  NewBusiness,
  Page,
  WorkspaceRepository,
} from "../features/workspace/WorkspaceRepository";
import type {
  CommandResult,
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
  WorkspaceReport,
} from "../../shared/workspace/model";

import type { BillingRequest, BusinessPlan, PaymentIntent } from "../../shared/workspace/billing";
export class FirebaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly functions: Functions) {}
  private async call<T>(name: string, input: unknown): Promise<T> {
    try {
      return (await httpsCallable<unknown, T>(this.functions, name)(input)).data;
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      if (code === "functions/internal" || code === "functions/unknown") {
        console.warn("No se pudo completar una llamada de KhypuPyme", { route: name, code });
      }
      throw cause;
    }
  }
  billing<T extends BusinessPlan | PaymentIntent | null>(request: BillingRequest) {
    return this.call<T>("workspaceBilling", request);
  }
  async exportBusiness(businessId: string) {
    const names = await this.call<string[]>("workspaceExport", { businessId, collection: "", cursor: "" });
    const collections: Record<string, unknown[]> = {};
    for (const collection of names) {
      const entries: unknown[] = [];
      let cursor = "";
      do {
        const page: Page<unknown> = await this.call("workspaceExport", { businessId, collection, cursor });
        entries.push(...page.items);
        cursor = page.next ?? "";
      } while (cursor);
      collections[collection] = entries;
    }
    return collections;
  }
  requestAccountDeletion() {
    return this.call<{ requestedAt: number }>("workspaceAccountDeletion", {});
  }
  deletion(request: DeletionRequest) {
    return this.call<DeletionResult>("workspaceDeletion", request);
  }
  tutorial(request: TutorialRequest) {
    return this.call<TutorialReply>("timberTutorial", request);
  }
  approval(phase: "prepare" | "approve", command: WorkspaceCommand, reason?: string) {
    return this.call<import("../../shared/workspace/protection").CorrectionChallenge | { approved: true }>("workspaceApproval", { phase, protocol: "workspace", command, ...(phase === "approve" ? { reason } : {}) });
  }
  businesses(cursor = "") {
    return this.call<Page<WorkspaceBusiness>>("workspaceAccount", {
      kind: "list",
      input: { cursor },
    });
  }
  business(id: string) {
    return this.call<WorkspaceBusiness>("workspaceAccount", {
      kind: "get",
      input: { id },
    });
  }
  create(input: NewBusiness) {
    return this.call<WorkspaceBusiness>("workspaceAccount", {
      kind: "create",
      input,
    });
  }
  creationStatus(input: NewBusiness) {
    return this.call<WorkspaceBusiness | null>("workspaceAccount", {
      kind: "status",
      input,
    });
  }
  execute(command: WorkspaceCommand) {
    return this.call<CommandResult>("workspaceCommand", command);
  }
  status(command: WorkspaceCommand) {
    return this.call<CommandResult | null>("workspaceStatus", command);
  }
  list<T>(query: WorkspaceQuery) {
    return this.call<Page<T>>("workspaceQuery", query);
  }
  report(businessId: string, from: string, to: string) {
    return this.call<WorkspaceReport>("workspaceReport", {
      businessId,
      from,
      to,
    });
  }
}
