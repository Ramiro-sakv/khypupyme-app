import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { serverMode } from "../billing/runtime.js";

const pattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[a-f0-9]{32}$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
const denied = () => new HttpsError("permission-denied", "La solicitud no corresponde a esta cuenta o venció.");

interface Transfer {
  proof: string;
  pairing: string;
  expiresAt: number;
  issuedAt: number;
  attempts: number;
  owner: string | null;
  state: "pending" | "confirmed" | "redeemed";
  uid?: string;
}

export const workspaceGoogleTransfer = onCall({ region: "us-central1", maxInstances: 2 }, async (request) => {
  if (serverMode() !== "hosted" || process.env.KHYPU_GOOGLE_TRANSFER !== "true")
    throw new HttpsError("failed-precondition", "El acceso desde Google necesita una configuración habilitada.");
  const app = getApps().length ? getApp() : initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const db = getFirestore(app);
  const raw = request.data as Record<string, unknown> | null;
  const now = Date.now();
  if (raw?.kind === "begin") {
    if (typeof raw.proof !== "string" || !pattern.test(raw.proof))
      throw new HttpsError("invalid-argument", "Solicitud de acceso incorrecta.");
    const id = randomBytes(16).toString("hex");
    // La clave que se escribe en el navegador es distinta del secreto de canje.
    const pairing = randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = now + 5 * 60_000;
    const rate = db.collection("googleTransferRates").doc(hash(request.rawRequest.ip || "unknown"));
    await db.runTransaction(async (tx) => {
      const saved = (await tx.get(rate)).data();
      const reused = saved && now - Number(saved.startedAt) < 10 * 60_000;
      const count = reused ? Number(saved.count) : 0;
      if (count >= 20) throw new HttpsError("resource-exhausted", "Hubo demasiados intentos. Vuelve a intentar más tarde.");
      tx.set(rate, { startedAt: reused ? saved.startedAt : now, count: count + 1, deleteAfter: Timestamp.fromMillis(now + 10 * 60_000) });
      tx.create(db.collection("googleTransfers").doc(id), {
        proof: hash(raw.proof as string), pairing: hash(pairing), issuedAt: now, expiresAt,
        owner: request.auth?.uid ?? null, attempts: 0, state: "pending", deleteAfter: Timestamp.fromMillis(expiresAt),
      });
    });
    return { id, pairing, expiresAt };
  }
  if (typeof raw?.id !== "string" || !idPattern.test(raw.id))
    throw new HttpsError("invalid-argument", "Solicitud de acceso incorrecta.");
  const ref = db.collection("googleTransfers").doc(raw.id);
  if (raw.kind === "confirm") {
    const auth = request.auth;
    if (!auth || auth.token.firebase.sign_in_provider !== "google.com" || auth.token.email_verified !== true ||
        typeof raw.pairing !== "string" || !/^[0-9A-F]{8}$/.test(raw.pairing)) throw denied();
    const pairing = hash(raw.pairing);
    const confirmed = await db.runTransaction(async (tx) => {
      const transfer = (await tx.get(ref)).data() as Transfer | undefined;
      if (!transfer || transfer.expiresAt <= now || transfer.state !== "pending" || transfer.attempts >= 5 ||
          (transfer.owner && transfer.owner !== auth.uid) || auth.token.auth_time < Math.floor(transfer.issuedAt / 1000)) return false;
      if (!same(transfer.pairing, pairing)) {
        tx.update(ref, { attempts: transfer.attempts + 1 });
        return false;
      }
      tx.update(ref, { state: "confirmed", uid: auth.uid });
      return true;
    });
    if (!confirmed) throw denied();
    return { state: "confirmed" };
  }
  if (raw.kind !== "redeem" || typeof raw.proof !== "string" || !pattern.test(raw.proof)) throw denied();
  const proof = hash(raw.proof);
  const uid = await db.runTransaction(async (tx) => {
    const transfer = (await tx.get(ref)).data() as Transfer | undefined;
    if (!transfer || transfer.expiresAt <= now || transfer.state === "redeemed" ||
        (transfer.owner && transfer.owner !== request.auth?.uid) || !same(transfer.proof, proof)) throw denied();
    if (transfer.state !== "confirmed" || !transfer.uid) return null;
    tx.update(ref, { state: "redeemed" });
    return transfer.uid;
  });
  if (!uid) return { state: "pending" };
  const auth = getAuth(app);
  const user = await auth.getUser(uid);
  if (user.disabled || !user.emailVerified || !user.providerData.some((provider) => provider.providerId === "google.com")) throw denied();
  return { state: "complete", token: await auth.createCustomToken(uid) };
});
