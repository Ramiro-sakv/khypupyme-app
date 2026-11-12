import type { ContainerBalance, ContainerTransfer, ContainerType } from "../../../shared/workspace/operations.js";
import type { UnitOfWork } from "./UnitOfWork.js";

export class ContainerService {
  constructor(private readonly work: UnitOfWork) {}
  async transfer(transfer: ContainerTransfer, customer: { id: string; name: string }, reference: string, reason: string, position = 0) {
    const { containerId, delivered, received } = transfer;
    const type = await this.work.get<ContainerType>("containerTypes", containerId);
    if (!type) throw new Error("El tipo de envase no pertenece a este negocio.");
    const id = containerId + "_" + customer.id;
    const previous = await this.work.get<ContainerBalance>("containerBalances", id);
    const pending = previous?.quantity ?? 0;
    if (!delivered && !received) throw new Error("Indica envases entregados o recibidos.");
    if (received > pending) throw new Error(`${type.name}: recibes ${received} y el cliente debe ${pending}.`);
    if (delivered > type.available + received)
      throw new Error(`${type.name}: entregas ${delivered} y hay ${type.available + received} disponibles.`);
    const quantity = pending - received + delivered;
    this.work.set("containerTypes", containerId, { ...type, available: type.available + received - delivered });
    this.work.set("containerBalances", id, {
      id, containerId, customerId: customer.id, customerName: customer.name, name: type.name, quantity,
      createdAt: previous?.createdAt ?? this.work.now,
    });
    for (const [direction, count] of [["in", received], ["out", delivered]] as const) {
      if (!count) continue;
      this.work.touchStock();
      const movementId = `${reference}-env-${position}-${direction}`;
      this.work.set("containerMovements", movementId, {
        id: movementId, reference, containerId, customerId: customer.id, customerName: customer.name,
        name: type.name, direction, quantity: count, reason, authorUid: this.work.uid, createdAt: this.work.now,
      });
    }
    return `${type.name}: ${delivered} entregados, ${received} recibidos, ${quantity} pendientes`;
  }
}
