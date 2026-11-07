import type { Firestore } from "firebase-admin/firestore";
import type { UnitOfWork } from "./UnitOfWork.js";
import type { TutorialSession } from "../../../shared/workspace/timber-tutorial.js";
import { TIMBER_STEPS } from "../../../shared/workspace/timber-tutorial.js";
import { validateTutorialAction } from "./TutorialPolicy.js";
import type {
  CommandResult,
  WorkspaceCommand,
} from "../../../shared/workspace/model.js";
export interface PracticeAccess {
  sessionId: string;
  sourceBusinessId: string;
}
export interface StoredTutorial extends TutorialSession {
  controlOperations: Record<string, string>;
  lastActivityAt: string;
  cleanupGoal?: "completed" | "abandoned";
}
export const sessionPath = (uid: string, id: string) =>
  "users/" + uid + "/tutorialSessions/" + id;
export function checkPractice(
  parent: Record<string, unknown>,
  uid: string,
  businessId: string,
  access: PracticeAccess | undefined,
  session: StoredTutorial | null,
  source: Record<string, unknown> | null,
) {
  if (!parent.tutorialSessionId) {
    if (access)
      throw new Error("El canal de práctica no admite negocios ordinarios.");
    return;
  }
  if (
    !access ||
    parent.tutorialSessionId !== access.sessionId ||
    parent.tutorialSourceBusinessId !== access.sourceBusinessId ||
    !session ||
    session.sourceBusinessId !== access.sourceBusinessId ||
    session.practiceBusinessId !== businessId ||
    businessId !== "practice-" + session.id ||
    !["active", "paused"].includes(session.status) ||
    session.expiresAt < new Date().toISOString() ||
    source?.ownerUid !== uid ||
    source?.tutorialSessionId
  )
    throw new Error(
      "La práctica no está disponible o no pertenece a esta cuenta y negocio.",
    );
}
export async function loadPractice(
  work: UnitOfWork,
  parent: Record<string, unknown>,
  access?: PracticeAccess,
) {
  const session = access
    ? await work.getPath<StoredTutorial>(
        sessionPath(work.uid, access.sessionId),
      )
    : null;
  const source = access
    ? await work.getPath<Record<string, unknown>>(
        "businesses/" + access.sourceBusinessId,
      )
    : null;
  checkPractice(parent, work.uid, work.businessId, access, session, source);
  return session;
}
export async function authorizePracticeRead(
  db: Firestore,
  uid: string,
  businessId: string,
  parent: Record<string, unknown>,
  access?: PracticeAccess,
) {
  const session = access
    ? ((await db.doc(sessionPath(uid, access.sessionId)).get()).data() as
        | StoredTutorial
        | undefined)
    : undefined;
  const source = access
    ? (await db.doc("businesses/" + access.sourceBusinessId).get()).data()
    : undefined;
  checkPractice(
    parent,
    uid,
    businessId,
    access,
    session ?? null,
    source ?? null,
  );
}
export function preparePractice(
  session: StoredTutorial | null,
  command: WorkspaceCommand,
) {
  if (session) validateTutorialAction(session, command);
}
export function checkpointPractice(
  work: UnitOfWork,
  session: StoredTutorial | null,
  result: CommandResult,
) {
  if (!session) return;
  const step = TIMBER_STEPS[session.stepIndex]!,
    references = { ...session.references };
  if (step.reference) references[step.reference] = result.id;
  work.setPath(sessionPath(work.uid, session.id), {
    ...session,
    references,
    stepIndex: session.stepIndex + 1,
    revision: session.revision + 1,
    lastActivityAt: work.now,
    expiresAt: new Date(Date.parse(work.now) + 7 * 86400000).toISOString(),
  });
}
