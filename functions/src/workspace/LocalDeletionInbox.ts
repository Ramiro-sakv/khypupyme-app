import { randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "../../../shared/app-errors.js";

export class LocalDeletionInbox {
  private readonly directory: string;
  constructor() {
    const profile = process.env.LOCALAPPDATA;
    const project = process.env.GCLOUD_PROJECT ?? "";
    const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "";
    if (!profile || process.env.FUNCTIONS_EMULATOR !== "true" ||
        !/^demo-[a-z0-9-]+$/.test(project) || !/^127\.0\.0\.1:(9099|19099)$/.test(auth))
      throw new AppError("El buzón solo está disponible en los emuladores locales de Windows.", 503, "LOCAL_INBOX");
    this.directory = join(profile, "KhypuPyme", "deletion-inbox", project, auth.split(":")[1]!);
  }
  async key(): Promise<Buffer> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = join(this.directory, ".key");
    try { return await readFile(target); }
    catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
    }
    const temp = join(this.directory, randomUUID() + ".tmp");
    await writeFile(temp, randomBytes(32), { flag: "wx", mode: 0o600 });
    try {
      await link(temp, target);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
    } finally {
      await rm(temp, { force: true });
    }
    return readFile(target);
  }
  async deliver(id: string, mail: { email: string; code: string; expiresAt: number }) {
    const target = join(this.directory, id + ".json");
    const temp = join(this.directory, randomUUID() + ".tmp");
    await writeFile(temp, JSON.stringify(mail), { flag: "wx", mode: 0o600 });
    try { await link(temp, target); }
    finally { await rm(temp, { force: true }); }
  }
  async discard(id: string | undefined) {
    if (id && /^[\da-f-]{36}$/.test(id))
      await rm(join(this.directory, id + ".json"), { force: true });
  }
}
