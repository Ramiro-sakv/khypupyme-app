import { canonical } from "../../../shared/commerce";
import type { PendingRequestStore } from "./PendingRequestStore";
import { definitiveFailure } from "./WorkspaceCommandService";
import type { NewBusiness, WorkspaceRepository } from "./WorkspaceRepository";
export class AccountCreationService {
  private locked = false;
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly journal: PendingRequestStore,
    private readonly uid: string,
  ) {}
  pending() {
    return this.journal.get(this.uid, "new");
  }
  async check() {
    if (this.locked) throw new Error("Espera a que termine la creación.");
    this.locked = true;
    try {
      const saved = await this.pending();
      if (!saved?.creation) throw new Error("No hay una creación pendiente.");
      const input = saved.request as NewBusiness,
        result = await this.repository.creationStatus(input);
      if (result) await this.journal.clear(this.uid, "new", input);
      return result;
    } finally {
      this.locked = false;
    }
  }
  async create(input: NewBusiness, retry = false) {
    if (this.locked) throw new Error("Ya hay una creación en curso.");
    this.locked = true;
    let own = false;
    try {
      if (!navigator.onLine)
        throw new Error("Recupera la conexión para continuar.");
      const saved = await this.pending();
      if (retry) {
        if (!saved?.creation || canonical(saved.request) !== canonical(input))
          throw new Error("Conserva la configuración pendiente original.");
        own = true;
        const confirmed = await this.repository.creationStatus(input);
        if (confirmed) {
          await this.journal.clear(this.uid, "new", input);
          return confirmed;
        }
      } else {
        if (saved) throw new Error("Resuelve primero la creación pendiente.");
        await this.journal.save(this.uid, "new", input, true);
        own = true;
      }
      const result = await this.repository.create(input);
      await this.journal.clear(this.uid, "new", input);
      return result;
    } catch (cause) {
      if (own && definitiveFailure(cause))
        await this.journal.clear(this.uid, "new", input);
      throw cause;
    } finally {
      this.locked = false;
    }
  }
}
