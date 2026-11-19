import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function activateBusiness(request, path) {
  const result = await request(path + "/plan/attempts", 200, "POST", { id: randomUUID(), planId: "30-days", cardId: "demo-visa" });
  const approved = await request(path + "/plan/attempts/" + result.id, 200, "POST", { action: "confirm" });
  assert.equal(approved.state, "approved");
}
