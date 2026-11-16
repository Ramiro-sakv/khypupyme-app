import { spawnSync } from "node:child_process";
import { readEnvironment } from "../src/config/environment.ts";

const env = { ...process.env, VITE_RUNTIME_TARGET: "web" };
if (env.VITE_SERVICE_PROFILE !== "render-pilot" || env.VITE_USE_EMULATORS !== "false")
  throw new Error("Configura el perfil privado de Render antes de compilar.");
readEnvironment(env);

for (const args of [
  ["functions/node_modules/typescript/bin/tsc", "-p", "functions/tsconfig.json"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
