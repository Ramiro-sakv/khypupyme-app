import { DomainError } from "../../shared/commerce";
import { AppError } from "../../shared/app-errors";
const statuses: Record<string, number> = {
  "invalid-argument": 400,
  "failed-precondition": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  aborted: 409,
  "resource-exhausted": 429,
  cancelled: 499,
  internal: 500,
  unknown: 500,
  unimplemented: 501,
  unavailable: 503,
  "deadline-exceeded": 504,
  "data-loss": 500,
};
export function errorMessage(
  error: unknown,
  fallback = "No se confirmó la operación. Consulta su estado antes de repetirla.",
): string {
  const raw =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          message?: unknown;
          details?: { appCode?: unknown };
        })
      : null;
  const code = String(raw?.code ?? ""),
    bare = code.replace(/^functions\//, "");
  let message =
    typeof error === "string"
      ? error
      : typeof raw?.message === "string"
        ? raw.message
        : "No se pudo completar la operación. Consulta su estado antes de repetirla.";
  let status =
    error instanceof AppError
      ? error.status
      : error instanceof DomainError
        ? 400
        : statuses[bare];
  if (code.startsWith("auth/")) {
    const auth: Record<string, [number, string]> = {
      "auth/email-already-in-use": [
        409,
        "Ese correo ya tiene una cuenta. Ingresa o recupera tu contraseña.",
      ],
      "auth/invalid-email": [400, "Revisa el correo electrónico."],
      "auth/weak-password": [
        400,
        "Usa una contraseña de al menos 12 caracteres.",
      ],
      "auth/invalid-credential": [401, "Revisa tu correo y contraseña."],
      "auth/user-not-found": [401, "Revisa tu correo y contraseña."],
      "auth/wrong-password": [401, "Revisa tu correo y contraseña."],
      "auth/user-token-expired": [401, "Tu sesión caducó. Vuelve a ingresar."],
      "auth/invalid-user-token": [401, "Tu sesión caducó. Vuelve a ingresar."],
      "auth/requires-recent-login": [
        401,
        "Vuelve a ingresar antes de realizar esta operación.",
      ],
      "auth/too-many-requests": [
        429,
        "Hubo demasiados intentos. Espera un momento y vuelve a intentar.",
      ],
      "auth/network-request-failed": [
        503,
        "No se confirmó la operación. Comprueba la conexión y que los emuladores estén encendidos.",
      ],
    };
    const known = auth[code];
    status = known?.[0] ?? 500;
    message =
      known?.[1] ??
      "No se pudo completar la autenticación. Vuelve a consultar antes de repetirla.";
  } else if (bare === "unauthenticated")
    message = "Tu sesión caducó. Vuelve a ingresar.";
  else if (bare === "permission-denied")
    message = "No tienes permiso para realizar esta operación.";
  else if (bare === "unavailable")
    message =
      "No se confirmó la operación. Comprueba la conexión y consulta su estado antes de repetirla.";
  else if (bare === "deadline-exceeded")
    message =
      "El servidor tardó demasiado. Consulta la confirmación antes de volver a enviar.";
  else if (
    bare === "internal" ||
    bare === "unknown" ||
    error instanceof TypeError
  ) {
    status = 500;
    message = fallback;
  }
  if (!message.trim()) message = fallback;
  const suffix = /\[(\d{3})(?:[^\]]*)?\]\s*$/.exec(message);
  if (suffix && (status === undefined || Number(suffix[1]) === status))
    return message;
  if (suffix) message = message.slice(0, suffix.index).trim();
  if (status === undefined)
    status = code
      ? 500
      : (error instanceof Error && error.constructor === Error) ||
          typeof error === "string"
        ? 400
        : 500;
  return message.replace(/\s+$/, "") + " [" + status + "]";
}
