import { AppError } from "../../../shared/app-errors.js";
import type { PaymentProviders } from "./providers.js";
import { productionPayments } from "./ProductionPayments.js";

export type ServerMode = "local" | "simulation" | "hosted";

export function serverMode(env = process.env): ServerMode {
  const project = env.GCLOUD_PROJECT ?? "";
  if (env.FUNCTIONS_EMULATOR === "true" && /^demo-[a-z0-9-]+$/.test(project) &&
      /^127\.0\.0\.1:(8080|18080)$/.test(env.FIRESTORE_EMULATOR_HOST ?? "") &&
      /^127\.0\.0\.1:(9099|19099)$/.test(env.FIREBASE_AUTH_EMULATOR_HOST ?? "")) {
    if (project === "demo-khypupyme-tests" && env.KHYPU_BILLING_MODE === "simulation" &&
        env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:18080" &&
        env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:19099") return "simulation";
    return "local";
  }
  if (env.KHYPU_SERVICE_PROFILE === "hosted" && env.KHYPU_HOSTED_PROJECT === project &&
      /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) && !project.startsWith("demo-") &&
      !env.FUNCTIONS_EMULATOR && !env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST && env.K_SERVICE)
    return "hosted";
  throw new AppError("Este servidor requiere una configuración de KhypuPyme autorizada.", 403, "SERVER_PROFILE");
}

export const externalBillingEnabled = () => ["staging", "live"].includes(process.env.KHYPU_BILLING_MODE ?? "");

export function billingProviders(mode: ServerMode): PaymentProviders {
  if (mode === "simulation") return {
    channels: ["qr"],
    qr: {
      async create(id, _amountMinor, expiresAt) {
        return { reference: "sim-" + id, image: "", expiresAt };
      },
      async check(id, reference) {
        return { reference, intentId: id, channel: "qr", status: "pending" };
      },
    },
  };
  return mode === "hosted" && externalBillingEnabled() ? productionPayments() : { channels: [] };
}
