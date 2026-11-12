import type { DeletionRequest, DeletionResult } from "../../../shared/workspace/business-deletion";
import type { WorkspaceReset } from "../../../shared/workspace/model";

export async function finishBusinessDeletion(
  request: (input: DeletionRequest) => Promise<DeletionResult>,
  businessId: string,
  active: () => boolean,
): Promise<WorkspaceReset | undefined> {
  while (active()) {
    const result = await request({ kind: "resume", businessId });
    if (result.state === "deleted") return result.reset;
    if (result.state !== "deleting") throw new Error("Consulta el estado del borrado en Mis negocios.");
  }
}
