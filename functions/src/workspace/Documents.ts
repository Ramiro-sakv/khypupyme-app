import { canonical, today } from "../../../shared/commerce.js";
import type {
  BusinessDocument,
  WorkspaceBusiness,
} from "../../../shared/workspace/model.js";
import { industryLabel } from "../../../shared/workspace/catalog.js";
import type { UnitOfWork } from "./UnitOfWork.js";

export class Documents {
  constructor(
    private readonly work: UnitOfWork,
    private readonly business: WorkspaceBusiness,
    private readonly operationId: string,
  ) {}
  get timberSystem() {
    return this.business.timberSystem ?? "imperial";
  }
  async issue(
    type: string,
    title: string,
    columns: string[],
    rows: string[][],
    totals: { label: string; minor: number }[],
    notes = "",
  ): Promise<BusinessDocument> {
    const year = today().slice(0, 4),
      counterId = `${type}-${year}`,
      counter = await this.work.get<{ value: number }>(
        "documentCounters",
        counterId,
      );
    const value = (counter?.value ?? 0) + 1;
    if (!Number.isSafeInteger(value) || value > 99999999)
      throw new Error("Se alcanzó el límite de numeración.");
    this.work.set("documentCounters", counterId, { value });
    const id = `${this.operationId}-${type}`,
      document: BusinessDocument = {
        id,
        number: `${type}-${year}-${String(value).padStart(6, "0")}`,
        businessId: this.business.id,
        businessName: this.business.name,
        industry: industryLabel(this.business.industryId),
        address: this.business.answers.address,
        phone: this.business.answers.phone,
        title,
        date: today(),
        columns,
        rows,
        totals,
        notes: [
          ...(this.business.tutorialSessionId
            ? ["PRÁCTICA — DATOS FICTICIOS. No es una venta real."]
            : []),
          ...(this.business.sampleData
            ? [
                "EJEMPLO · DATOS FICTICIOS. No corresponde a operaciones reales.",
              ]
            : []),
          notes,
          this.business.answers.documentFooter,
          "Documento no fiscal.",
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: this.work.now,
      };
    if (Buffer.byteLength(JSON.stringify(document), "utf8") > 850000)
      throw new Error(
        "El documento supera el límite de tamaño. Reduce el periodo o divide la operación.",
      );
    this.work.set("documentsV2", id, {
      ...document,
      // Firestore no admite arrays directamente anidados; el contrato público mantiene filas de celdas.
      rows: document.rows.map((cells) => ({ cells })),
      signature: canonical(document),
    });
    return document;
  }
}
