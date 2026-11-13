import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = process.cwd();
const manual = process.argv.includes("--manual");
const browser = process.argv.includes("--browser");
const withFunctions = browser || manual;
for (const port of [18080, 19099, 19150, 14400, 14500, ...(withFunctions ? [15001, 4173] : [])]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error(`El puerto ${port} está ocupado. Cierra la sesión de simulación o pruebas antes de continuar.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
const fixture = mkdtempSync(join(tmpdir(), "khypupyme-billing-"));
const firebase = join(root, "node_modules/firebase-tools/lib/bin/firebase.js");
mkdirSync(fixture, { recursive: true });
for (const file of ["firebase.test.json", "firestore.rules", "firestore.indexes.json"]) cpSync(file, join(fixture, file));
function runNode(file, args) {
  const result = spawnSync(process.execPath, [join(root, file), ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (withFunctions) {
  const source = join(fixture, "functions");
  mkdirSync(source);
  cpSync(join(root, "functions/package.json"), join(source, "package.json"));
  symlinkSync(join(root, "functions/node_modules"), join(source, "node_modules"), "junction");
  // Firebase solo carga valores ficticios en la copia temporal de Functions.
  writeFileSync(join(source, ".secret.local"), "KHYPU_QR_BASIC=fixture\nKHYPU_QR_WEBHOOK_SECRET=fixture\n");
  runNode("node_modules/typescript/bin/tsc", ["-p", "functions/tsconfig.json", "--outDir", join(source, "lib")]);
}

const runner = join(fixture, "billing.cjs");
const args = manual
  ? ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173", "--strictPort"]
  : browser
  ? ["node_modules/@playwright/test/cli.js", "test", "billing-pilot.spec.ts", "--project=desktop-chromium", "--reporter=list"]
  : ["node_modules/vitest/vitest.mjs", "run", "--project", "integration", "--project", "rules", "billing.test.ts"];
writeFileSync(runner, `const {spawnSync}=require('node:child_process');const [program,...args]=${JSON.stringify(args)};
const r=spawnSync(process.execPath,[require('node:path').join(${JSON.stringify(root)},program),...args],{cwd:${JSON.stringify(root)},stdio:'inherit'});process.exit(r.status??1);`);
const run = spawnSync(process.execPath, [firebase, "emulators:exec", "--only", withFunctions ? "auth,firestore,functions" : "auth,firestore",
  "--project", "demo-khypupyme-tests", "--config", "firebase.test.json", 'node "' + runner + '"'], {
  cwd: fixture, stdio: "inherit",
  env: withFunctions ? {
    ...process.env, KHYPU_BILLING_MODE: "simulation", VITE_BILLING_SIMULATION: "true",
    ...(process.platform === "win32" && !process.env.KHYPU_BILLING_BROWSER ? { KHYPU_BILLING_BROWSER: "msedge" } : {}),
    VITE_FIREBASE_PROJECT_ID: "demo-khypupyme-tests", VITE_EMULATOR_PROFILE: "test", VITE_USE_EMULATORS: "true", VITE_RUNTIME_TARGET: "web",
  } : process.env,
});
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
