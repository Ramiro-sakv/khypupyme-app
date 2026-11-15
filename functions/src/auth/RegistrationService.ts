import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
interface Challenge {
  id: string;
  digest: string;
  attempts: number;
  expiresAt: number;
  state: "pending" | "verified" | "complete";
  uid: string;
}
interface Rate { startedAt: number; count: number; lastSentAt: number }
type Deliver = (email: string, code: string, id: string) => Promise<void>;
const invalidCode = () => new AppError("El código es incorrecto, venció o llegó al límite de intentos. Solicita uno nuevo.", 400, "SIGNUP_CODE");
const rateError = () => new AppError("Espera antes de solicitar otro código de registro.", 429, "SIGNUP_RATE");
const same = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
const errorCode = (error: unknown) => (error as { code?: unknown } | null)?.code;

export class RegistrationService {
  constructor(private readonly db: Firestore, private readonly auth: Auth, private readonly secret: string,
    private readonly deliver: Deliver, private readonly now = Date.now) {}

  private digest(value: string) { return createHmac("sha256", this.secret).update(value).digest("hex"); }
  private account(email: string) { return this.db.collection("registrationChallenges").doc(this.digest("email:" + email)); }

  async send(email: string, ip: string) {
    const id = randomUUID(), uid = randomUUID(), code = String(randomInt(100_000)).padStart(5, "0");
    const now = this.now();
    const challenge = this.account(email);
    const rate = this.db.collection("registrationRates");
    const emailRate = rate.doc(this.digest("recipient:" + email));
    const ipRate = rate.doc(this.digest("address:" + ip));
    await this.db.runTransaction(async (tx) => {
      const [recipient, source, previous] = await tx.getAll(emailRate, ipRate, challenge);
      const old = previous?.data() as Challenge | undefined;
      if (old?.state === "verified" && old.expiresAt > now)
        throw new AppError("Hay un registro confirmado en proceso. Vuelve a intentar con el mismo código.", 409, "SIGNUP_PENDING");
      for (const [snapshot, ref, limit, wait] of [[recipient, emailRate, 3, MINUTE], [source, ipRate, 20, 0]] as const) {
        const state = snapshot?.data() as Rate | undefined;
        if (state && (now - state.lastSentAt < wait || (now - state.startedAt < HOUR && state.count >= limit)))
          throw rateError();
        const current = state && now - state.startedAt < HOUR ? state : { startedAt: now, count: 0 };
        tx.set(ref, { startedAt: current.startedAt, count: current.count + 1, lastSentAt: now, deleteAfter: Timestamp.fromMillis(now + HOUR) });
      }
      tx.set(challenge, { id, uid, digest: this.digest(id + ":" + code), attempts: 0, state: "pending",
        expiresAt: now + 10 * MINUTE, deleteAfter: Timestamp.fromMillis(now + 25 * MINUTE) });
    });
    try {
      await this.deliver(email, code, id);
    } catch {
      // Mantener el límite de envíos incluso si falla el proveedor.
      await this.db.runTransaction(async (tx) => {
        const current = (await tx.get(challenge)).data() as Challenge | undefined;
        if (current?.id === id && current.state === "pending") tx.update(challenge, { expiresAt: this.now() });
      });
      throw new AppError("No se pudo entregar el código. Reintenta el envío en un minuto.", 503, "SIGNUP_DELIVERY");
    }
    return { id, expiresAt: now + 10 * MINUTE };
  }

  async complete(email: string, id: string, code: string, password: string) {
    const ref = this.account(email);
    const uid = await this.db.runTransaction(async (tx) => {
      const challenge = (await tx.get(ref)).data() as Challenge | undefined;
      const now = this.now();
      if (!challenge || challenge.id !== id || challenge.expiresAt <= now || challenge.attempts >= 5) return null;
      const valid = same(challenge.digest, this.digest(id + ":" + code));
      if (!valid) {
        tx.update(ref, { attempts: challenge.attempts + 1 });
        return null;
      }
      if (challenge.state === "pending") tx.update(ref, { state: "verified" });
      return challenge.uid;
    });
    if (!uid) throw invalidCode();
    try {
      await this.auth.createUser({ uid, email, password, emailVerified: true });
    } catch (error) {
      if (!["auth/email-already-exists", "auth/uid-already-exists"].includes(String(errorCode(error)))) throw error;
      const existing = await this.auth.getUser(uid).catch((cause: unknown) => {
        if (errorCode(cause) === "auth/user-not-found")
          throw new AppError("Esta dirección ya tiene cuenta. Ingresa o recupera tu acceso.", 409, "SIGNUP_EXISTS");
        throw cause;
      });
      if (existing.email !== email || !existing.emailVerified || existing.disabled)
        throw new AppError("Esta dirección ya tiene cuenta. Ingresa o recupera tu acceso.", 409, "SIGNUP_EXISTS");
    }
    await this.db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as Challenge | undefined;
      if (current?.id === id && current.state !== "complete") tx.update(ref, { state: "complete" });
    });
    // El cliente inicia sesión con su contraseña. Repetir el código no emite credenciales.
    return { complete: true };
  }
}
