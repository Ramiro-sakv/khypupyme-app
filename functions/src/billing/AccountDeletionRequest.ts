import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import { identifier } from "../../../shared/workspace/validation.js";

export async function requestAccountDeletion(db: Firestore, uid: string, authTime: number, now = Date.now()) {
  if (!Number.isSafeInteger(authTime) || authTime < 1 || authTime * 1000 > now || now - authTime * 1000 > 5 * 60_000)
    throw new AppError("Confirma tu contraseña para solicitar la baja.", 401, "ACCOUNT_DELETION_AUTH");
  const ref = db.doc("accountDeletionRequests/" + identifier(uid));
  return db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    const requestedAt = (old.get("requestedAt") as number | undefined) ?? now;
    if (!old.exists) tx.create(ref, { uid, state: "requested", requestedAt });
    return { requestedAt };
  });
}
