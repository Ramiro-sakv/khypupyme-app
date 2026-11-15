import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, expect, it } from "vitest";
import { RegistrationService } from "../../functions/src/auth/RegistrationService";
import { requireTestEmulators, testProjectId } from "../emulator-environment";

requireTestEmulators();
const modules = createRequire(new URL("../../functions/package.json", import.meta.url));
const { deleteApp, initializeApp } = modules("firebase-admin/app");
const app = initializeApp({ projectId: testProjectId }, "signup-" + randomUUID());
const auth = modules("firebase-admin/auth").getAuth(app);
const db = modules("firebase-admin/firestore").getFirestore(app);
afterAll(() => deleteApp(app));

it("crea la cuenta solo después de validar el código y repite el resultado sin cambiar la contraseña", async () => {
  const email = randomUUID() + "@example.invalid";
  let code = "";
  const service = new RegistrationService(db, auth, "integration-only-secret", async (_email, sent) => { code = sent; });
  const sent = await service.send(email, "test-" + randomUUID());
  expect(code).toMatch(/^\d{5}$/);
  await expect(auth.getUserByEmail(email)).rejects.toMatchObject({ code: "auth/user-not-found" });
  await expect(service.complete(email, sent.id, code === "00001" ? "00002" : "00001", "secure-pass-12")).rejects.toMatchObject({ appCode: "SIGNUP_CODE" });
  await expect(service.complete(email, sent.id, code, "secure-pass-12")).resolves.toEqual({ complete: true });
  const user = await auth.getUserByEmail(email);
  expect(user.emailVerified).toBe(true);
  await service.complete(email, sent.id, code, "different-password");
  expect((await auth.getUserByEmail(email)).uid).toBe(user.uid);
});

it("limita reenvíos e intentos e invalida códigos anteriores o vencidos", async () => {
  const email = randomUUID() + "@example.invalid", ip = "test-" + randomUUID();
  const codes = new Map<string, string>();
  let now = Date.now();
  const service = new RegistrationService(db, auth, "integration-only-secret", async (_email, code, id) => { codes.set(id, code); }, () => now);
  const first = await service.send(email, ip);
  await expect(service.send(email, ip)).rejects.toMatchObject({ appCode: "SIGNUP_RATE" });
  now += 60_000;
  const second = await service.send(email, ip);
  await expect(service.complete(email, first.id, codes.get(first.id)!, "secure-pass-12")).rejects.toMatchObject({ appCode: "SIGNUP_CODE" });
  const wrong = codes.get(second.id) === "00001" ? "00002" : "00001";
  for (let n = 0; n < 5; n++) await expect(service.complete(email, second.id, wrong, "secure-pass-12")).rejects.toMatchObject({ appCode: "SIGNUP_CODE" });
  await expect(service.complete(email, second.id, codes.get(second.id)!, "secure-pass-12")).rejects.toMatchObject({ appCode: "SIGNUP_CODE" });
  now += 60_000;
  const third = await service.send(email, ip);
  now += 10 * 60_000;
  await expect(service.complete(email, third.id, codes.get(third.id)!, "secure-pass-12")).rejects.toMatchObject({ appCode: "SIGNUP_CODE" });
  await expect(service.send(email, ip)).rejects.toMatchObject({ appCode: "SIGNUP_RATE" });
  await expect(auth.getUserByEmail(email)).rejects.toMatchObject({ code: "auth/user-not-found" });
});
