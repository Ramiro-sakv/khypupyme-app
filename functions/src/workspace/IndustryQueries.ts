import type { CollectionReference } from "firebase-admin/firestore";
import { today } from "../../../shared/commerce.js";
import { INDUSTRIES } from "../../../shared/business-industries.js";
import { add, ZERO } from "../../../shared/workspace/exact.js";
import type { Quantity } from "../../../shared/workspace/exact.js";
import type { EquipmentHistory, Item, PurchaseLineV2, ReturnInput, SaleV2, SetupProgress, WorkspaceBusiness } from "../../../shared/workspace/model.js";
import { identifier } from "../../../shared/workspace/validation.js";
import type { Serial } from "./InventoryService.js";

export class IndustryQueries {
  constructor(private readonly collection: (name: string) => CollectionReference) {}

  async setupProgress(business: WorkspaceBusiness) {
    const stocks = !business.industryId || INDUSTRIES[business.industryId].profile !== "services";
    const exists = async (name: string) => !(await this.collection(name).limit(1).get()).empty;
    const [catalog, purchase, sale, legacyCatalog, legacyPurchase, legacySale, legacyStock] = await Promise.all([
      exists("items"), stocks && exists("purchasesV2"), exists("salesV2"),
      business.legacy && exists("products"), business.legacy && stocks && exists("purchases"),
      business.legacy && exists("sales"),
      business.legacy && this.collection("products").where("stock", ">", 0).limit(1).get().then((page) => !page.empty),
    ]);
    const progress: SetupProgress = { catalog: catalog || legacyCatalog, purchase: purchase || legacyPurchase, sale: sale || legacySale, legacyStock };
    return { items: [progress], next: null };
  }

  async saleAvailability(id: unknown) {
    const itemId = identifier(id);
    const product = await this.collection("items").doc(itemId).get();
    const item = product.data() as Item | undefined;
    if (!item?.active || !["general", "grocery"].includes(item.kind))
      return { items: [], next: null };
    const lots = await this.collection("lots").where("itemId", "==", itemId)
      .where("available", "==", true).limit(10001).get();
    if (lots.size > 10000) throw new Error("Hay más de 10.000 lotes disponibles de este producto.");
    const date = today();
    const balance = lots.docs.reduce((total, doc) => {
      const lot = doc.data() as { expiresOn: string; balance: Quantity };
      return !lot.expiresOn || lot.expiresOn >= date ? add(total, lot.balance) : total;
    }, ZERO);
    return { items: [{ id: itemId, balance }], next: null };
  }

  async equipmentHistory(id: unknown) {
    const serialId = identifier(id);
    const unit = await this.collection("serials").doc(serialId).get();
    if (!unit.exists) return { items: [], next: null };
    const serial = unit.data() as Serial;
    const purchaseId = /^(.*)-s\d+$/.exec(serialId)?.[1];
    const [item, purchases, sales, claims] = await Promise.all([
      this.collection("items").doc(serial.itemId).get(),
      purchaseId ? this.collection("purchasesV2").doc(purchaseId).get() : null,
      this.collection("salesV2").where("createdAt", ">=", serial.createdAt).limit(10001).get(),
      this.collection("warrantyClaims").where("serialId", "==", serialId).limit(101).get(),
    ]);
    if (sales.size > 10000 || claims.size > 100)
      throw new Error("El historial supera el límite de consulta de esta unidad.");
    const purchase = purchases?.data() as { number: string; date: string; lines: PurchaseLineV2[] } | undefined;
    const history: EquipmentHistory = {
      id: serialId, serial: serial.serial, itemName: item.data()?.name ?? "Equipo", status: serial.status,
      receivedAt: serial.createdAt,
      purchase: purchase?.lines.some((line) => line.stockIds.includes(serialId))
        ? { number: purchase.number, date: purchase.date } : null,
      sales: [],
    };
    for (const doc of sales.docs) {
      const sale = doc.data() as SaleV2;
      const line = sale.lines.find((line) => line.allocations.some((allocation) => allocation.stockId === serialId));
      const allocation = line?.allocations.find((entry) => entry.stockId === serialId);
      if (!line || !allocation) continue;
      const returned = allocation.returned.n !== "0";
      const returns = returned
        ? await this.collection("returns").where("saleId", "==", doc.id).limit(101).get()
        : null;
      if (returns && returns.size > 100) throw new Error("La venta tiene más de 100 devoluciones para consultar.");
      history.sales.push({
        id: doc.id, number: sale.number, date: sale.date, customerName: sale.customerName,
        warrantyUntil: line.warrantyUntil, returned,
        returns: (returns?.docs ?? []).flatMap((entry) => {
          const record = entry.data() as { number: string; date: string; lines: ReturnInput[] };
          return record.lines.some((input) => input.serials.includes(serialId))
            ? [{ id: entry.id, number: record.number, date: record.date }] : [];
        }),
        claims: claims.docs.filter((entry) => entry.data().saleId === doc.id).map((entry) => {
          const claim = entry.data();
          return { id: entry.id, status: claim.status, description: claim.description, resolution: claim.resolution };
        }),
      });
    }
    history.sales.sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    return { items: [history], next: null };
  }
}
