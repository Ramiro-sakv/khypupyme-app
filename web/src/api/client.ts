import { apiUrl, isNative } from "../native/platform";
import { nativeLogout, nativeToken } from "../native/session";

const auth = "/api/v1/auth";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message.endsWith("[" + status + "]") ? message : message + " [" + status + "]");
  }
}

async function read<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const nativeSession = isNative && path === auth + "/session";
  const emptySession = { email: null, accountId: null, googleConfigured: false, googleLinked: false, localMailbox: false };
  if (isNative) {
    const token = await nativeToken();
    if (!token && nativeSession) return emptySession as T;
    if (!token) throw new ApiError(401, "Ingresa de nuevo para continuar.");
    headers.set("Authorization", "Bearer " + token);
  }
  const response = await fetch(apiUrl(nativeSession ? auth + "/native-session" : path), {
    ...init, headers, cache: "no-store", credentials: isNative ? "omit" : "same-origin",
    ...(isNative && { redirect: "error" }),
  }).catch((failure: unknown) => {
    if (init?.signal?.aborted || !(failure instanceof TypeError)) throw failure;
    throw new ApiError(503, "No se pudo conectar con KhypuPyme. Comprueba la conexión e inténtalo de nuevo.");
  });
  if (nativeSession && response.status === 401) {
    await nativeLogout(false);
    return emptySession as T;
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new ApiError(response.status, problem?.detail ?? ({
      401: "Ingresa de nuevo para continuar.",
      404: "No se encontró el negocio.",
      429: "Espera antes de volver a intentar.",
      503: "El servicio no está disponible. Comprueba la conexión y vuelve a consultar.",
    }[response.status] ?? "No se pudo completar la solicitud. Vuelve a intentar."));
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return read<T>(path, { signal });
}

export async function change<T>(path: string, method: "POST" | "PUT", body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isNative) headers["X-CSRF-TOKEN"] = (await get<{ token: string }>(auth + "/csrf", signal)).token;
  return read<T>(path, {
    method,
    headers,
    signal,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

export async function linkGoogle() {
  const { token } = await get<{ token: string }>(auth + "/csrf");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = auth + "/google/link";
  const input = document.createElement("input");
  input.name = "__RequestVerificationToken";
  input.value = token;
  input.type = "hidden";
  form.append(input);
  document.body.append(form);
  form.submit();
}
