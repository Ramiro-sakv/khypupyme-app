import type { WorkspaceReset } from "../../../shared/workspace/model";
import { operationJournal } from "./OperationJournal";
import { draftRepository } from "./IndexedDbDraftRepository";
export async function resetLocalWorkspace(
  uid: string,
  reset: WorkspaceReset | undefined,
) {
  if (!reset) return;
  if (
    !reset.id ||
    !Array.isArray(reset.removedBusinessIds) ||
    !Array.isArray(reset.removedCreationOperationIds) ||
    reset.removedBusinessIds.some((id) => typeof id !== "string" || !id)
  )
    throw new Error("Aviso de sustitución de datos incompatible.");
  const key = "khypupyme:applied-reset:" + uid;
  if (localStorage.getItem(key) === reset.id) return;
  await draftRepository.purgeRemoved(uid, reset.removedBusinessIds);
  await operationJournal.purgeRemoved(
    uid,
    reset.removedBusinessIds,
    reset.removedCreationOperationIds,
  );
  const lastKey = "khypupyme:last-business:" + uid;
  if (reset.removedBusinessIds.includes(localStorage.getItem(lastKey) ?? ""))
    localStorage.removeItem(lastKey);
  if (reset.removedBusinessIds.includes(uid))
    for (const kind of ["inventory", "commerce"])
      sessionStorage.removeItem("khypupyme:pending-" + kind + ":" + uid);
  localStorage.setItem(key, reset.id);
}
