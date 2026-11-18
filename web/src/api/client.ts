const auth = "/api/v1/auth";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function read<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new ApiError(response.status, problem?.detail ?? ({
      401: "Ingresa de nuevo para continuar.",
      404: "No se encontró el negocio.",
      429: "Espera antes de volver a intentar.",
    }[response.status] ?? "No se pudo completar la solicitud. Vuelve a intentar."));
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return read<T>(path, { signal });
}

export async function change<T>(path: string, method: "POST" | "PUT", body?: unknown): Promise<T> {
  const { token } = await get<{ token: string }>(auth + "/csrf");
  return read<T>(path, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
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
