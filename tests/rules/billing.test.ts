import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { requireTestEmulators, testProjectId } from "../emulator-environment";

requireTestEmulators();
const environment = await initializeTestEnvironment({
  projectId: testProjectId,
  firestore: { host: "127.0.0.1", port: 18080 },
});
afterAll(() => environment.cleanup());

it("impide que el propietario lea o escriba licencias, pagos y solicitudes privadas directamente", async () => {
  const uid = randomUUID();
  const businessId = randomUUID();
  const paths = [
    "businessLicenses/" + businessId, "businessLicenses/" + businessId + "/checkout/qr",
    "billingReceipts/" + businessId, "billingIntents/" + businessId,
    "users/" + uid + "/billing/trial", "accountDeletionRequests/" + uid,
  ];
  const client = environment.authenticatedContext(uid).firestore();
  for (const path of paths) {
    await assertFails(setDoc(doc(client, path), { ownerUid: uid, periods: [] }));
    await assertFails(getDoc(doc(client, path)));
  }
  expect(paths).toHaveLength(6);
});
