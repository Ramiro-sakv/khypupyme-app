import type { Firestore, Transaction } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import type { AccessPeriod } from "../../../shared/workspace/billing.js";

export interface License {
  ownerUid: string;
  periods: AccessPeriod[];
}

export const licensePath = (businessId: string) => `businessLicenses/${businessId}`;
export const trialPath = (uid: string) => `users/${uid}/billing/trial`;

export async function requireLicense(db: Firestore, tx: Transaction, uid: string, businessId: string, at: number) {
  const doc = await tx.get(db.doc(licensePath(businessId)));
  const license = doc.data() as License | undefined;
  if (license?.ownerUid !== uid || !license.periods.some((period) => period.startsAt <= at && at < period.endsAt))
    throw new AppError("El plan de este negocio no está vigente. Puedes consultar y exportar tus registros o renovar desde Configuración.", 403, "BUSINESS_PLAN_REQUIRED");
}
