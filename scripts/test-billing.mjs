import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = process.cwd();
for (const port of [18080, 19099, 19150, 14400, 14500]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error(`El puerto ${port} está ocupado. No se ejecutaron pruebas.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
const fixture = mkdtempSync(join(tmpdir(), "khypupyme-billing-"));
const firebase = join(root, "node_modules/firebase-tools/lib/bin/firebase.js");
mkdirSync(fixture, { recursive: true });
for (const file of ["firebase.test.json", "firestore.rules", "firestore.indexes.json"]) cpSync(file, join(fixture, file));
const runner = join(fixture, "billing.cjs");
writeFileSync(runner, `const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,[${JSON.stringify(join(root, "node_modules/vitest/vitest.mjs"))},'run','--project','integration','--project','rules','billing.test.ts'],{cwd:${JSON.stringify(root)},stdio:'inherit'});process.exit(r.status??1);`);
const run = spawnSync(process.execPath, [firebase, "emulators:exec", "--only", "auth,firestore", "--project", "demo-khypupyme-tests",
  "--config", "firebase.test.json", 'node "' + runner + '"'], { cwd: fixture, stdio: "inherit" });
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
