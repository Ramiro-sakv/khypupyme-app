import { defineSecret } from "firebase-functions/params";
import { AppError } from "../../../shared/app-errors.js";

export const emailKey = defineSecret("KHYPU_EMAIL_API_KEY");
export const registrationKey = defineSecret("KHYPU_REGISTRATION_KEY");

export async function sendEmail(to: string, subject: string, text: string, requestId: string) {
  const from = process.env.KHYPU_EMAIL_FROM;
  const apiKey = emailKey.value();
  if (!from || !apiKey) throw new AppError("El servicio de correo todavía no está configurado.", 503, "EMAIL_UNAVAILABLE");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json", "idempotency-key": requestId },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) throw new AppError("No se pudo entregar el correo. Vuelve a intentarlo más tarde.", 503, "EMAIL_DELIVERY");
}
