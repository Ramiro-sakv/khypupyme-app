import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url)),
  project = "demo-khypupyme";
const authorization = JSON.parse(
  await readFile(
    path.join(root, "artifacts/industry-reset-authorization.local.json"),
    "utf8",
  ),
);
const approvedUid = authorization.uid,
  approvedIds = authorization.businessIds;
if (
  authorization.project !== project ||
  typeof approvedUid !== "string" ||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(approvedUid) ||
  !Array.isArray(approvedIds) ||
  approvedIds.length !== 4 ||
  new Set(approvedIds).size !== 4 ||
  approvedIds.some(
    (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id),
  )
)
  throw new Error(
    "Autorización local inválida: se requieren la cuenta y los cuatro negocios aprobados.",
  );
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--inspect"))
  throw new Error(
    "Usa --inspect para revisar o --apply para ejecutar la sustitución autorizada.",
  );
Object.assign(process.env, {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GCLOUD_PROJECT: project,
});
const require = createRequire(path.join(root, "functions/package.json"));
const { initializeApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore"),
  { getAuth } = require("firebase-admin/auth");
initializeApp({ projectId: project });
const db = getFirestore(),
  auth = getAuth(),
  users = await auth.listUsers(2);
if (
  users.users.length !== 1 ||
  users.pageToken ||
  users.users[0].uid !== approvedUid
)
  throw new Error(
    "La cuenta única ya no coincide con la autorización. No se modificó nada.",
  );
const dir = path.join(root, "artifacts"),
  manifestPath = path.join(dir, "industry-demo-v05.local.json");
let state;
try {
  state = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (state && (state.uid !== approvedUid || state.project !== project))
  throw new Error("El manifiesto pertenece a otro entorno.");
const current = await db.collection("businesses").get(),
  knownNew = Object.values(state?.businesses ?? {}).map((b) => b.id);
for (const doc of current.docs) {
  if (
    doc.data().ownerUid !== approvedUid ||
    (!approvedIds.includes(doc.id) && !knownNew.includes(doc.id))
  )
    throw new Error(
      "Existe un negocio fuera de la lista autorizada. Se detuvo la operación.",
    );
}
if (!state && approvedIds.some((id) => !current.docs.some((d) => d.id === id)))
  throw new Error("Cambió la lista original de cuatro negocios.");
if (!apply) {
  console.log(
    JSON.stringify({
      project,
      accounts: 1,
      oldBusinesses: current.docs
        .filter((d) => approvedIds.includes(d.id))
        .map((d) => ({ id: d.id, name: d.data().name })),
      examples: knownNew.length,
      willPreserveAccount: true,
    }),
  );
  process.exit(0);
}
const moduleAt = (relative) =>
  import(pathToFileURL(path.join(root, "functions/lib", relative)).href);
const [
  { AccountService },
  { WorkspaceService },
  { demoCatalog },
  { INDUSTRIES, INDUSTRY_IDS },
  { DEFAULT_ANSWERS },
  { decimal, ZERO },
  { today },
  { hasAgenda, hasDelivery, workKindFor },
] = await Promise.all([
  moduleAt("functions/src/workspace/AccountService.js"),
  moduleAt("functions/src/workspace/WorkspaceService.js"),
  moduleAt("shared/workspace/demo-catalog.js"),
  moduleAt("shared/business-industries.js"),
  moduleAt("shared/workspace/catalog.js"),
  moduleAt("shared/workspace/exact.js"),
  moduleAt("shared/commerce.js"),
  moduleAt("shared/workspace/operations.js"),
]);
const account = new AccountService(db),
  commerce = new WorkspaceService(db);
if (!state)
  state = {
    version: "0.5.0-beta.1",
    project,
    uid: approvedUid,
    setId: randomUUID(),
    baseDate: today(),
    phase: "prepared",
    businesses: {},
    requests: {},
    results: {},
    removedCreationOperationIds: [],
  };
await mkdir(dir, { recursive: true });
const persist = async () => {
  const temporary = manifestPath + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  // Windows/OneDrive o un lector pueden bloquear brevemente el archivo de destino.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, manifestPath);
      break;
    } catch (error) {
      if (!["EPERM", "EBUSY", "EACCES"].includes(error.code) || attempt >= 19)
        throw error;
      await delay(Math.min(100 * (attempt + 1), 1000));
    }
  }
};
await persist();
const idFor = (industry, step) =>
  "demo-" +
  createHash("sha256")
    .update(state.setId + "|" + industry + "|" + step)
    .digest("hex")
    .slice(0, 40);
const day = (offset) =>
  new Date(Date.parse(state.baseDate + "T12:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
if (["prepared", "deleting"].includes(state.phase)) {
  const keys = await db
    .collection("users/" + approvedUid + "/operationKeys")
    .where("businessId", "in", approvedIds)
    .get();
  state.removedCreationOperationIds = [
    ...new Set([
      ...state.removedCreationOperationIds,
      ...keys.docs
        .filter((d) => d.data().kind === "create-business")
        .map((d) => d.id),
    ]),
  ];
  state.phase = "deleting";
  await persist();
  for (const id of approvedIds) {
    const ref = db.doc("businesses/" + id),
      doc = await ref.get();
    if (doc.exists && doc.data().ownerUid !== approvedUid)
      throw new Error("Propietario distinto. Se detuvo el borrado.");
    if (doc.exists) await db.recursiveDelete(ref);
    await db.doc("users/" + approvedUid + "/businesses/" + id).delete();
  }
  for (let start = 0; start < keys.docs.length; start += 400) {
    const batch = db.batch();
    for (const doc of keys.docs.slice(start, start + 400))
      batch.delete(doc.ref);
    await batch.commit();
  }
  await db.doc("users/" + approvedUid).set(
    {
      workspaceReset: {
        id: state.setId,
        removedBusinessIds: approvedIds,
        removedCreationOperationIds: state.removedCreationOperationIds,
      },
    },
    { merge: true },
  );
  state.phase = "seeding";
  await persist();
  console.log("Cuatro negocios retirados; cuenta conservada.");
}
for (const industry of INDUSTRY_IDS) {
  const name = "Ejemplo · " + INDUSTRIES[industry].name;
  if (!state.businesses[industry]) {
    const request = {
      operationId: idFor(industry, "create-business"),
      name,
      industryId: industry,
      answers: {
        ...DEFAULT_ANSWERS,
        weighted: ["convenience", "grocery", "pets"].includes(industry),
        bulk: industry === "cement",
        address: "Dirección ficticia de demostración",
        documentFooter: "EJEMPLO · DATOS FICTICIOS. No es una operación real.",
      },
    };
    const business = await account.create(approvedUid, request);
    state.businesses[industry] = { id: business.id, name };
    await persist();
  }
  const businessId = state.businesses[industry].id;
  await db
    .doc("businesses/" + businessId)
    .set(
      { sampleData: { version: state.version, setId: state.setId } },
      { merge: true },
    );
  const run = async (step, action) => {
    const key = industry + "/" + step;
    if (state.results[key]) return state.results[key];
    if (!state.requests[key]) {
      state.requests[key] = {
        apiVersion: 2,
        businessId,
        operationId: idFor(industry, step),
        ...action,
      };
      await persist();
    }
    const result = await commerce.execute(approvedUid, state.requests[key]);
    state.results[key] = result;
    await persist();
    return result;
  };
  const read = async (resource, id) =>
    (
      await db.doc("businesses/" + businessId + "/" + resource + "/" + id).get()
    ).data();
  const products = demoCatalog(industry),
    itemIds = products.map((_, i) => idFor(industry, "item-" + i)),
    clients = [0, 1, 2].map((i) => ({
      id: idFor(industry, "client-" + i),
      name: "Cliente Ejemplo " + (i + 1),
    }));
  for (let i = 0; i < 3; i++)
    await run("client-" + i, {
      kind: "customer",
      input: {
        ...clients[i],
        phone: "",
        notes: "Cliente ficticio para aprender el recorrido.",
        active: true,
      },
    });
  await run("open-cash", { kind: "open-cash", input: { amountMinor: 100000 } });
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    await run("item-" + i, {
      kind: "create-item",
      input: {
        item: p.item,
        opening: {
          qty: ZERO,
          unit: p.unit,
          unitCostMinor: 0,
          lot: "",
          expiresOn: "",
          serials: [],
        },
      },
    });
  }
  const physical = products
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.item.kind !== "service");
  for (let batch = 0; batch < (physical.length ? 3 : 0); batch++)
    await run("purchase-" + batch, {
      kind: "purchase",
      input: {
        lines: physical.map((p) => ({
          itemId: itemIds[p.index],
          qty: decimal(p.quantity),
          unit: p.unit,
          unitCostMinor: p.costMinor + batch * 10,
          lot: "LOTE-DEMO-" + (batch + 1) + "-" + (p.index + 1),
          expiresOn: p.item.kind === "grocery" ? day([5, 30, 90][batch]) : "",
          serials:
            p.item.kind === "appliance"
              ? Array.from(
                  { length: Number(p.quantity) },
                  (_, i) =>
                    "DEMO-" +
                    industry.toUpperCase() +
                    "-" +
                    p.index +
                    "-" +
                    batch +
                    "-" +
                    i,
                )
              : [],
        })),
        method: "transfer",
        date: day(-14 + batch),
        reference: "Compra ficticia de aprendizaje " + (batch + 1),
      },
    });
  const line = async (index, step, quote = false) => {
    const product = products[index],
      serials = [];
    if (product.item.kind === "appliance" && !quote) {
      const available = await db
        .collection("businesses/" + businessId + "/serials")
        .where("itemId", "==", itemIds[index])
        .where("status", "==", "available")
        .limit(1)
        .get();
      if (!available.size)
        throw new Error("Ejemplo sin serie disponible: " + industry);
      serials.push(available.docs[0].id);
    }
    // La solicitud completa se persiste antes de enviar: una reanudación conserva la serie original.
    const old = state.requests[industry + "/" + step];
    const oldLine = old?.input?.lines?.[0] ?? old?.input?.sale?.lines?.[0];
    return (
      oldLine ?? {
        itemId: itemIds[index],
        qty: decimal("1"),
        unit: product.unit,
        fullBoxes: false,
        wastePercent: 0,
        serials,
        expectedPriceMinor: product.item.priceMinor,
      }
    );
  };
  for (let i = 0; i < 7; i++) {
    const step = "sale-" + i,
      method = i === 3 || i === 6 ? "credit" : i % 2 ? "qr" : "cash",
      client = clients[i % 3];
    await run(step, {
      kind: "sale",
      input: {
        lines: [await line(0, step)],
        method,
        date: day(-6 + i),
        customerId: client.id,
        customerName: client.name,
        discountMinor: 0,
        quoteId: "",
      },
    });
  }
  await run("collect-example", {
    kind: "collect",
    input: { id: idFor(industry, "sale-3"), method: "qr" },
  });
  for (let i = 0; i < 2; i++)
    await run("expense-" + i, {
      kind: "expense",
      input: {
        amountMinor: 1500 + i * 500,
        method: i ? "qr" : "cash",
        date: day(-2 + i),
        description: i
          ? "Papelería del negocio de ejemplo"
          : "Transporte de ejemplo",
        category: "Operación",
      },
    });
  for (let i = 0; i < 2; i++)
    await run("quote-" + i, {
      kind: "quote",
      input: {
        lines: [await line(i, "quote-" + i, true)],
        customerId: clients[i].id,
        customerName: clients[i].name,
        discountMinor: 0,
        validUntil: day(7),
      },
    });
  if (physical.length) {
    const sale = await read("salesV2", idFor(industry, "sale-0")),
      original = sale.lines[0];
    await run("return-example", {
      kind: "return",
      input: {
        saleId: sale.id,
        lines: [
          {
            line: 0,
            qty: decimal("1"),
            unit: original.requestedUnit,
            restock: true,
            serials:
              original.kind === "appliance"
                ? original.allocations.map((a) => a.stockId)
                : [],
          },
        ],
        reason: "Devolución ficticia para aprender el historial",
        method: "cash",
      },
    });
  }
  if (["appliances", "electronics"].includes(industry)) {
    const sale = await read("salesV2", idFor(industry, "sale-1"));
    await run("warranty-example", {
      kind: "warranty",
      input: {
        saleId: sale.id,
        serialId: sale.lines[0].allocations[0].stockId,
        description: "Consulta ficticia de funcionamiento",
        status: "received",
        resolution: "",
      },
    });
  }
  if (industry === "cement")
    await run("unpack-example", {
      kind: "unpack",
      input: { sourceId: itemIds[0], targetId: itemIds[2], bags: decimal("2") },
    });
  if (hasAgenda(industry)) {
    const common = {
      customerId: clients[1].id,
      customerName: clients[1].name,
      title: "Corte de cabello de ejemplo",
    };
    await run("appointment-future", {
      kind: "appointment",
      input: {
        id: "",
        expectedRevision: 0,
        ...common,
        startAt: day(1) + "T10:00:00-04:00",
        endAt: day(1) + "T10:30:00-04:00",
        status: "scheduled",
      },
    });
    await run("appointment-past", {
      kind: "appointment",
      input: {
        id: "",
        expectedRevision: 0,
        ...common,
        startAt: day(-1) + "T09:00:00-04:00",
        endAt: day(-1) + "T09:30:00-04:00",
        status: "scheduled",
      },
    });
    const sourceId = idFor(industry, "appointment-past");
    await run("appointment-attended", {
      kind: "appointment",
      input: {
        id: sourceId,
        expectedRevision: 1,
        ...common,
        startAt: day(-1) + "T09:00:00-04:00",
        endAt: day(-1) + "T09:30:00-04:00",
        status: "attended",
      },
    });
    await run("appointment-sale", {
      kind: "operational-sale",
      input: {
        sourceKind: "appointment",
        sourceId,
        expectedRevision: 2,
        sale: {
          lines: [await line(0, "appointment-sale")],
          method: "qr",
          date: day(-1),
          customerId: clients[1].id,
          customerName: clients[1].name,
          discountMinor: 0,
          quoteId: "",
        },
      },
    });
  }
  const kind = workKindFor(industry);
  if (kind) {
    const common = {
      kind,
      customerId: clients[2].id,
      customerName: clients[2].name,
      title: "Trabajo de ejemplo · " + INDUSTRIES[industry].name,
      description:
        kind === "repair"
          ? "Ventilador DEMO-001, no enciende; revisar interruptor."
          : "Alcance y especificaciones ficticias acordadas con el cliente.",
      address: "Dirección ficticia de demostración",
      dueOn: day(2),
      checks:
        kind === "repair"
          ? [
              "Diagnóstico registrado",
              "Presupuesto aprobado",
              "Funcionamiento revisado",
            ]
          : ["Revisar requerimiento", "Completar trabajo", "Preparar entrega"],
      budgetMinor: products[5].item.priceMinor,
    };
    await run("order-open", {
      kind: "work-order",
      input: { id: "", expectedRevision: 0, ...common, status: "received" },
    });
    await run("order-approved", {
      kind: "work-order",
      input: {
        id: idFor(industry, "order-open"),
        expectedRevision: 1,
        ...common,
        status: "approved",
      },
    });
    await run("order-progress", {
      kind: "work-order",
      input: {
        id: idFor(industry, "order-open"),
        expectedRevision: 2,
        ...common,
        status: "in-progress",
      },
    });
    await run("order-completed", {
      kind: "work-order",
      input: {
        id: "",
        expectedRevision: 0,
        ...common,
        title: "Trabajo listo de ejemplo",
        status: "received",
      },
    });
    const sourceId = idFor(industry, "order-completed");
    for (const [i, status] of ["approved", "in-progress", "ready"].entries())
      await run("order-ready-" + i, {
        kind: "work-order",
        input: {
          id: sourceId,
          expectedRevision: i + 1,
          ...common,
          title: "Trabajo listo de ejemplo",
          status,
        },
      });
    await run("order-sale", {
      kind: "operational-sale",
      input: {
        sourceKind: "work-order",
        sourceId,
        expectedRevision: 4,
        sale: {
          lines: [await line(5, "order-sale")],
          method: "qr",
          date: day(0),
          customerId: clients[2].id,
          customerName: clients[2].name,
          discountMinor: 0,
          quoteId: "",
        },
      },
    });
  }
  if (hasDelivery(industry)) {
    for (let i = 0; i < 2; i++) {
      const step = "delivery-" + i,
        base = {
          saleId: idFor(industry, "sale-" + (i + 1)),
          address: "Dirección ficticia " + (i + 1),
          scheduledOn: day(i ? 0 : 1),
          reference: "Entrega ficticia sin nuevo movimiento de stock",
        };
      await run(step, {
        kind: "delivery",
        input: { id: "", expectedRevision: 0, ...base, status: "pending" },
      });
      await run(step + "-prepared", {
        kind: "delivery",
        input: {
          id: idFor(industry, step),
          expectedRevision: 1,
          ...base,
          status: "prepared",
        },
      });
      if (i)
        await run(step + "-delivered", {
          kind: "delivery",
          input: {
            id: idFor(industry, step),
            expectedRevision: 2,
            ...base,
            status: "delivered",
          },
        });
    }
  }
  if (industry === "beverages") {
    await run("container-type", {
      kind: "container-type",
      input: {
        name: "Botella retornable de ejemplo",
        unit: "bottle",
        quantity: 100,
      },
    });
    const input = {
      containerId: idFor(industry, "container-type"),
      customerId: clients[0].id,
      reason: "Movimiento ficticio de envases",
    };
    await run("container-out", {
      kind: "container-move",
      input: { ...input, direction: "out", quantity: 24 },
    });
    await run("container-in", {
      kind: "container-move",
      input: { ...input, direction: "in", quantity: 12 },
    });
  }
  // Si el cierre se confirmó antes de una interrupción, conservar su solicitud original.
  const previousClose = state.requests[industry + "/close-cash"];
  if (previousClose) await run("close-cash", previousClose);
  else {
    const control = await read("cashControl", "current");
    if (!control?.activeId)
      throw new Error("No hay caja para cerrar en el ejemplo " + industry);
    const cash = await read("cashSessions", control.activeId);
    await run("close-cash", {
      kind: "close-cash",
      input: { countedMinor: cash.balanceMinor, reason: "" },
    });
  }
  await run("cash-open-current", {
    kind: "open-cash",
    input: { amountMinor: 50000 },
  });
  await run("inventory-document", {
    kind: "report-document",
    input: { from: day(-14), to: day(0), inventory: true },
  });
  await run("result-document", {
    kind: "report-document",
    input: { from: day(-14), to: day(0), inventory: false },
  });
  console.log(industry + ": ejemplo cargado.");
}
const summary = [];
for (const industry of INDUSTRY_IDS) {
  const id = state.businesses[industry].id,
    counts = {};
  for (const resource of [
    "items",
    "customersV2",
    "purchasesV2",
    "salesV2",
    "quotes",
    "expensesV2",
    "debts",
    "cashSessions",
    "documentsV2",
    "appointments",
    "workOrders",
    "deliveries",
    "containerTypes",
  ])
    counts[resource] = (
      await db
        .collection("businesses/" + id + "/" + resource)
        .count()
        .get()
    ).data().count;
  summary.push({ industry, businessId: id, ...counts });
}
const all = await db.collection("businesses").get(),
  accountAfter = await auth.listUsers(2);
if (
  all.size !== 21 ||
  all.docs.some(
    (d) => d.data().ownerUid !== approvedUid || !d.data().sampleData,
  ) ||
  approvedIds.some((id) => all.docs.some((d) => d.id === id)) ||
  accountAfter.users.length !== 1 ||
  accountAfter.users[0].uid !== approvedUid
)
  throw new Error(
    "La comprobación de carga no coincide con la sustitución autorizada.",
  );
state.phase = "complete";
state.summary = summary;
await persist();
await writeFile(
  path.join(dir, "industry-demo-v05-summary.local.json"),
  JSON.stringify(
    {
      version: state.version,
      project,
      accounts: 1,
      businesses: all.size,
      previousBusinessesRemoved: 4,
      summary,
    },
    null,
    2,
  ),
  "utf8",
);
const requireCli = createRequire(path.join(root, "package.json")),
  cli = requireCli.resolve("firebase-tools/lib/bin/firebase.js"),
  exportDir = path.resolve(root, ".emulator-data");
if (path.dirname(exportDir) !== path.resolve(root))
  throw new Error("Destino de exportación fuera del proyecto.");
const exported = spawnSync(
  process.execPath,
  [cli, "emulators:export", exportDir, "--force", "--project", project],
  { cwd: root, env: process.env, encoding: "utf8" },
);
if (exported.status !== 0) {
  console.error(exported.stderr || exported.stdout);
  throw new Error(
    "Los ejemplos están cargados, pero falló su exportación local. Reanuda para exportarlos.",
  );
}
state.exportedAt = new Date().toISOString();
await persist();
console.log(
  "Listo: misma cuenta, 21 ejemplos y exportación local actualizada.",
);
