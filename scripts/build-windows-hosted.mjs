import { spawnSync } from "node:child_process";
import { readEnvironment } from "../src/config/environment.ts";

const config = readEnvironment({ ...process.env, VITE_RUNTIME_TARGET: "windows" });
if (process.env.VITE_USE_EMULATORS !== "false") throw new Error("Este comando requiere el perfil alojado.");
const auth = `https://${config.projectId}.firebaseapp.com`;
const functions = process.env.VITE_SERVICE_PROFILE === "render-pilot" ? process.env.VITE_KHYPU_PILOT_ORIGIN : `https://us-central1-${config.projectId}.cloudfunctions.net`;
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ${auth} ${functions}; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'`;
const result = spawnSync(process.execPath, [
  "node_modules/@tauri-apps/cli/tauri.js", "build", "--bundles", "nsis", "--config",
  JSON.stringify({ productName: "KhypuPyme", app: { windows: [{ title: "KhypuPyme", width: 1280, height: 850, minWidth: 360, minHeight: 620 }], security: { csp } } }),
], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
