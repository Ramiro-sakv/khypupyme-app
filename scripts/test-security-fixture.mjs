const sensitive = new Set(["return", "exchange", "void-expense", "void-debt", "cash-adjust", "stock-in", "stock-loss", "inspection",
  "hold-lot", "release-lot", "discard-lot", "open-cement"]);

export async function authorizeFixture(base, path, method, body, headers, password, request) {
  const business = method === "POST" && /^\/api\/v1\/businesses\/([a-f0-9-]+)\/commerce\/commands$/.exec(path);
  if (!business || !body?.operationId) return;
  if (!(sensitive.has(body.kind) || (["product", "customer"].includes(body.kind) && body.entityId))) {
    if (body.kind !== "close-cash") return;
    const { session } = await request(path.replace(/\/commands$/, "/cash"), 200);
    if (!session || session.id !== body.sourceId || session.closedAt || session.expectedMinor === body.amountMinor) return;
  }
  const approval = await fetch(base + "/api/v1/security/proof", { method: "POST", headers, body: JSON.stringify({
    id: body.operationId, businessId: business[1], purpose: "correction", command: body, reason: "Regresión de prueba", password,
  }) });
  // La ejecución verifica el error esperado de cada prueba, incluso al intentar reutilizar el ID en otro ámbito.
  await approval.arrayBuffer();
}
