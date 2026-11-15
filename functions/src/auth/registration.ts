import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AppError } from "../../../shared/app-errors.js";
import { identifier, oneOf, object } from "../../../shared/workspace/validation.js";
import { serverMode } from "../billing/runtime.js";
import { RegistrationService } from "./RegistrationService.js";

import { emailKey, registrationKey, sendEmail } from "./sendEmail.js";
const validators = {
  email(value: unknown) {
    if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      throw new HttpsError("invalid-argument", "Escribe un correo electrónico válido.");
    return value.trim().toLowerCase();
  },
  password(value: unknown) {
    if (typeof value !== "string" || value.length < 12 || value.length > 128)
      throw new HttpsError("invalid-argument", "Usa una contraseña de 12 a 128 caracteres.");
    return value;
  },
  code(value: unknown) {
    if (typeof value !== "string" || !/^\d{5}$/.test(value))
      throw new HttpsError("invalid-argument", "Ingresa los cinco dígitos del código.");
    return value;
  },
};

export const workspaceRegistration = onCall({ region: "us-central1", maxInstances: 2, secrets: [registrationKey, emailKey] }, async (request) => {
  try {
    const mode = serverMode();
    if (mode === "local") throw new HttpsError("failed-precondition", "Usa el entorno de simulación para probar el registro con código.");
    const secret = registrationKey.value();
    const sender = process.env.KHYPU_EMAIL_FROM;
    const inbox = process.env.KHYPU_SIGNUP_INBOX;
    if (secret.length < 32 || (mode === "hosted" && (!sender || !emailKey.value())))
      throw new HttpsError("unavailable", "El registro por correo requiere configurar el remitente.");
    const app = getApps().length ? getApp() : initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const service = new RegistrationService(getFirestore(app), getAuth(app), secret, async (to, code, id) => {
      if (mode === "simulation") {
        if (inbox) await writeFile(path.join(inbox, id + ".txt"), code, { flag: "wx", mode: 0o600 });
        console.log("Código ficticio de registro " + id + ": " + code);
        return;
      }
      await sendEmail(to, "Confirma tu correo de KhypuPyme",
        "Tu código de KhypuPyme es " + code + ". Caduca en 10 minutos. Si no solicitaste el registro, puedes ignorar este correo.",
        "khypu-registration-" + id);
    });
    const raw = request.data as { kind?: unknown } | null;
    const kind = oneOf(["send", "complete"])(raw?.kind);
    if (kind === "send") {
      const { email } = object(raw, { kind: () => kind, email: validators.email });
      return await service.send(email as string, request.rawRequest.ip || "unknown");
    }
    const data = object(raw, { kind: () => kind, email: validators.email, id: identifier, code: validators.code, password: validators.password });
    return await service.complete(data.email as string, data.id as string, data.code as string, data.password as string);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof AppError) {
      const statuses = { 400: "invalid-argument", 409: "already-exists", 429: "resource-exhausted", 503: "unavailable" } as const;
      throw new HttpsError(statuses[error.status as keyof typeof statuses] ?? "internal", error.message, { appCode: error.appCode });
    }
    if (error?.constructor === Error && typeof (error as { code?: unknown }).code === "undefined" &&
        ["Opción desconocida.", "Identificador inválido.", "La solicitud contiene campos incorrectos.", "Solicitud inválida."].includes((error as Error).message))
      throw new HttpsError("invalid-argument", "Revisa los datos del registro.");
    throw new HttpsError("internal", "No pudimos completar el registro. Vuelve a consultar o intenta ingresar si ya lo confirmaste.");
  }
});

export const requireVerifiedSignup = beforeUserCreated({ region: "us-central1" }, (event) => {
  // El alta Admin y el acceso federado verificado deben seguir disponibles.
  if (process.env.FUNCTIONS_EMULATOR === "true" && process.env.KHYPU_BILLING_MODE !== "simulation") return;
  if (event.data?.emailVerified && (event.credential?.providerId === "google.com" || event.data.providerData.some((provider) => provider.providerId === "google.com"))) return;
  throw new HttpsError("permission-denied", "Verifica tu correo con el código de KhypuPyme para crear la cuenta.");
});
