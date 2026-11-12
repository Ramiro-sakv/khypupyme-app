import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const fixture = process.argv[2] === "--fixture";
const profile = process.env.LOCALAPPDATA;
if (!profile) throw new Error("No se encontró el perfil local de Windows.");
const dir = join(profile, "KhypuPyme", "deletion-inbox", fixture ? "demo-khypupyme-tests" : "demo-khypupyme", fixture ? "19099" : "9099");
const files = await readdir(dir).catch((cause) => {
  if (cause.code === "ENOENT") return [];
  throw cause;
});
let found = false;
for (const file of files.filter((name) => /^[\da-f-]{36}\.json$/.test(name))) {
  const mail = await readFile(join(dir, file), "utf8").then(JSON.parse).catch((cause) => {
    if (cause.code === "ENOENT") return null;
    throw cause;
  });
  if (!mail) continue;
  if (mail.expiresAt <= Date.now()) {
    await rm(join(dir, file), { force: true });
    continue;
  }
  found = true;
  console.log(`Código ${mail.code} · vence ${new Date(mail.expiresAt).toLocaleTimeString("es-BO")}`);
}
if (!found) console.log("El buzón local no tiene códigos vigentes.");
