import { spawnSync } from "node:child_process";
import { readEnvironment } from "../src/config/environment.ts";

if (process.env.VITE_USE_EMULATORS !== "false") throw new Error("Este comando requiere el perfil alojado.");
readEnvironment({ ...process.env, VITE_RUNTIME_TARGET: "android" });
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}
run(process.execPath, ["scripts/build-native-web.mjs", "android"]);
run(process.execPath, ["node_modules/@capacitor/cli/bin/capacitor", "sync", "android"]);
run("gradlew.bat :app:bundleRelease", [], { cwd: "android", shell: true });
