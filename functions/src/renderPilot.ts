import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import { serverMode } from "./billing/runtime.js";
import {
  timberTutorial, workspaceAccount, workspaceAccountDeletion, workspaceApproval,
  workspaceBilling, workspaceCommand, workspaceExport, workspaceQuery, workspaceReport, workspaceStatus,
} from "./index.js";

const routes = new Map([
  ["timberTutorial", timberTutorial], ["workspaceAccount", workspaceAccount],
  ["workspaceAccountDeletion", workspaceAccountDeletion], ["workspaceApproval", workspaceApproval],
  ["workspaceBilling", workspaceBilling], ["workspaceCommand", workspaceCommand],
  ["workspaceExport", workspaceExport], ["workspaceQuery", workspaceQuery],
  ["workspaceReport", workspaceReport], ["workspaceStatus", workspaceStatus],
]);
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};
const root = resolve("dist");
const maxBody = 256 * 1024;

function configure() {
  const projectId = process.env.KHYPU_HOSTED_PROJECT;
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw new Error("El proyecto de Render no coincide con el proyecto piloto.");
  process.env.GCLOUD_PROJECT = projectId ?? "";
  const uid = process.env.KHYPU_PILOT_UID ?? "";
  if (serverMode() !== "render-pilot" || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    throw new Error("Configura el UID del probador y el proyecto piloto antes de iniciar.");
  const credentialJson = process.env.KHYPU_FIREBASE_SERVICE_ACCOUNT ?? "";
  try {
    const data = JSON.parse(credentialJson);
    if (data.type !== "service_account" || data.project_id !== projectId ||
        typeof data.client_email !== "string" || typeof data.private_key !== "string") throw new Error();
    initializeApp({ projectId, credential: cert({ projectId, clientEmail: data.client_email, privateKey: data.private_key }) });
  } catch {
    throw new Error("La credencial privada de Firebase está ausente o no pertenece a khypupyme-piloto.");
  }
  return { uid, allowedOrigins: new Set([process.env.RENDER_EXTERNAL_URL, "http://tauri.localhost", "https://tauri.localhost", "https://localhost"]) };
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readData(request: IncomingMessage) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new HttpsError("invalid-argument", "La solicitud debe usar JSON.");
  if (Number(request.headers["content-length"]) > maxBody) throw new HttpsError("invalid-argument", "La solicitud es demasiado grande.");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBody) throw new HttpsError("invalid-argument", "La solicitud es demasiado grande.");
    chunks.push(buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Object.keys(value).length !== 1 || !Object.hasOwn(value, "data")) throw new Error();
    return value.data as unknown;
  } catch {
    throw new HttpsError("invalid-argument", "La solicitud es inválida.");
  }
}

async function servePage(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (request.method !== "GET" && request.method !== "HEAD") return json(response, 405, { error: "Método no admitido." });
  const requested = resolve(root, "." + pathname);
  if (requested !== root && !requested.startsWith(root + sep)) return json(response, 404, { error: "Página no encontrada." });
  const filename = extname(pathname) ? requested : resolve(root, "index.html");
  const file = await stat(filename).catch(() => null);
  const type = mimeTypes[extname(filename)];
  if (!file?.isFile() || !type) return json(response, 404, { error: "Página no encontrada." });
  response.writeHead(200, { "Content-Type": type, "Content-Length": file.size,
    "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
  if (request.method === "HEAD") return response.end();
  createReadStream(filename).on("error", () => response.destroy()).pipe(response);
}

const { uid, allowedOrigins } = configure();
const server = createServer({ requestTimeout: 30_000 }, async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://pilot.local").pathname);
    if (pathname === "/healthz" && request.method === "GET") return json(response, 200, { status: "ok", mode: "render-pilot" });
    if (!pathname.startsWith("/api/")) return await servePage(request, response, pathname);
    const origin = request.headers.origin;
    if (origin) {
      if (!allowedOrigins.has(origin)) throw new HttpsError("permission-denied", "Origen fuera de la prueba privada.");
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (request.method === "OPTIONS") return response.writeHead(204).end();
    const endpoint = routes.get(pathname.slice(5));
    if (request.method !== "POST" || !endpoint) throw new HttpsError("not-found", "Operación fuera del piloto.");
    const bearer = /^Bearer ([\w.-]{1,8192})$/.exec(request.headers.authorization ?? "")?.[1];
    if (!bearer) throw new HttpsError("unauthenticated", "Inicia sesión con la cuenta de prueba.");
    const token = await getAuth().verifyIdToken(bearer, true).catch(() => null);
    if (!token) throw new HttpsError("unauthenticated", "La sesión venció. Vuelve a iniciar sesión.");
    if (token.uid !== uid) throw new HttpsError("permission-denied", "Esta cuenta no tiene acceso al piloto privado.");
    const data = await readData(request);
    // Estas llamadas obtienen su identidad del token verificado por este transporte.
    const result = await endpoint.run({ data, auth: { uid, token, rawToken: bearer }, rawRequest: request as CallableRequest<unknown>["rawRequest"], acceptsStreaming: false });
    return json(response, 200, { result: result ?? null });
  } catch (cause) {
    request.resume();
    const error = cause instanceof HttpsError ? cause : new HttpsError("internal", "No se pudo confirmar la operación. Consulta su estado antes de repetirla.");
    if (error.code === "internal") console.error("Error en el servidor del piloto");
    if (!response.headersSent) return json(response, error.httpErrorCode.status, { error: error.toJSON() });
    response.destroy();
  }
});
server.listen(Number(process.env.PORT ?? 10000), "0.0.0.0", () => console.log("Piloto de KhypuPyme iniciado."));
