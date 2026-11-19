import { apiUrl, base64, bridge, clientId, redirectUri } from "./platform";

type Grant = { access_token: string; refresh_token: string; expires_in: number };
type Handshake = { verifier: string; state: string; expires: number };
let access: { value: string; expires: number } | null = null;
let obtaining: Promise<string | null> | null = null;

const base64Url = (bytes: Uint8Array) => base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const random = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

async function post(path: string, data: Record<string, string>) {
  return fetch(apiUrl(path), {
    method: "POST", body: new URLSearchParams({ client_id: clientId, ...data }),
    cache: "no-store", credentials: "omit", redirect: "error",
  });
}

async function exchange(fields: Record<string, string>) {
  const response = await post("/connect/token", fields);
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) return null;
    throw new Error("No se pudo consultar la sesión del piloto. Vuelve a intentar.");
  }
  const grant = await response.json() as Grant;
  if (!grant.refresh_token || !grant.access_token) throw new Error("El servicio no devolvió una sesión completa.");
  await bridge.save("token", grant.refresh_token);
  access = { value: grant.access_token, expires: Date.now() + Math.max(grant.expires_in - 20, 0) * 1000 };
  return access.value;
}

async function readHandshake() {
  const raw = await bridge.load("handshake");
  return raw ? JSON.parse(raw) as Handshake : null;
}

async function complete(handshake: Handshake) {
  const callback = await bridge.callback();
  if (!callback) return null;
  const url = new URL(callback);
  if (url.href.split(/[?#]/, 1)[0] !== redirectUri || url.searchParams.get("state") !== handshake.state) return null;
  await bridge.clear("handshake");
  const code = url.searchParams.get("code");
  if (!code) throw new Error("El navegador no autorizó el ingreso. Vuelve a abrirlo desde la aplicación.");
  const token = await exchange({ grant_type: "authorization_code", code, code_verifier: handshake.verifier, redirect_uri: redirectUri });
  if (!token) throw new Error("El regreso del navegador ya venció. Vuelve a iniciar sesión.");
  return token;
}

export function nativeToken() {
  if (access && access.expires > Date.now()) return Promise.resolve(access.value);
  obtaining ??= (async () => {
    const refresh = await bridge.load("token");
    if (!refresh) {
      const handshake = await readHandshake();
      return handshake && handshake.expires > Date.now() ? complete(handshake) : null;
    }
    const token = await exchange({ grant_type: "refresh_token", refresh_token: refresh });
    if (!token) await bridge.clear("token");
    return token;
  })().finally(() => { obtaining = null; });
  return obtaining;
}

export async function nativeLogin() {
  const saved = await readHandshake();
  if (saved && saved.expires > Date.now() && await complete(saved)) return;

  const handshake = { state: random(), verifier: random(), expires: Date.now() + 300_000 };
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(handshake.verifier))));
  const query = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri,
    response_type: "code", scope: "offline_access khypupyme_api",
    code_challenge: challenge, code_challenge_method: "S256", state: handshake.state, prompt: "login",
  });
  await bridge.save("handshake", JSON.stringify(handshake));
  try { await bridge.start(apiUrl("/connect/authorize?" + query)); }
  catch { throw new Error("No se pudo abrir el navegador. Cierra otra ventana de ingreso si sigue abierta y vuelve a intentar."); }
  while (Date.now() < handshake.expires) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    if (await complete(handshake)) return;
  }
  await bridge.clear("handshake");
  throw new Error("Se agotó el tiempo para regresar del navegador. Puedes volver a intentar.");
}

export async function nativeLogout(revoke = true) {
  const refresh = await bridge.load("token");
  const current = access?.value;
  access = null;
  await bridge.clear("token");
  await bridge.clear("handshake");
  if (revoke) await Promise.allSettled([
    ...(refresh ? [post("/connect/revoke", { token: refresh, token_type_hint: "refresh_token" })] : []),
    ...(current ? [post("/connect/revoke", { token: current, token_type_hint: "access_token" })] : []),
  ]);
}
