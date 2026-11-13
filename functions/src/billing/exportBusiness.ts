import { FieldPath } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";

const collections = new Set([
  "items", "timberSpecies", "timberGroups", "lots", "serials", "movementsV2", "salesV2", "purchasesV2",
  "quotes", "returns", "customersV2", "expensesV2", "expenseReversals", "debts", "paymentsV2",
  "cashSessions", "cashEntries", "documentsV2", "warrantyClaims", "appointments", "workOrders", "workflowEvents",
  "deliveries", "containerTypes", "containerBalances", "containerMovements", "auditEvents",
  "products", "inventoryMovements", "sales", "purchases", "purchaseReversals", "expenses", "receivables",
  "payments", "customers", "services", "cashEvents", "legacyConversions",
]);

export async function exportBusiness(db: Firestore, uid: string, businessId: string, collection: string, cursor: string) {
  const root = db.doc("businesses/" + businessId);
  return db.runTransaction(async (tx) => {
    const business = (await tx.get(root)).data();
    if (business?.ownerUid !== uid || business.deletionPending || business.tutorialSessionId)
      throw new AppError("No tienes acceso a este negocio.", 403, "EXPORT_OWNER");
    if (!collection && !cursor) return [...collections];
    if (!collections.has(collection)) throw new AppError("Esta colección no se puede exportar.", 400, "EXPORT_COLLECTION");
    let query = root.collection(collection).orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor);
    const page = (await tx.get(query)).docs;
    return {
      items: page.slice(0, 50).map((doc) => ({ ...doc.data(), id: doc.id })),
      next: page.length > 50 ? page[49]!.id : null,
    };
  }, { readOnly: true });
}
