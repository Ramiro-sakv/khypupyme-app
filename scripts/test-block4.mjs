import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { activateBusiness } from "./test-billing-fixture.mjs";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { authorizeFixture } from "./test-security-fixture.mjs";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const base = "http://127.0.0.1:5183";
const mailbox = process.env.Email__MailboxPath;
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const email = "block4-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque cuatro 2026!";
const cookies = new Map();

async function request(path, expected, method = "GET", body, approve = true) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", (await request(auth + "/csrf", 200)).token);
    headers.set("Content-Type", "application/json");
  }
  if (cookies.size) headers.set("Cookie", [...cookies].map(([key, value]) => key + "=" + value).join("; "));
  if (approve) await authorizeFixture(base, path, method, body, headers, password, request);
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const equal = pair.indexOf("=");
    cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
  const result = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
  assert.equal(response.status, expected, method + " " + path + (result?.detail ? " · " + result.detail : ""));
  return result;
}

function readCode() {
  for (const item of readdirSync(mailbox).filter((file) => file.endsWith(".json"))) {
    const path = join(mailbox, item);
    const message = JSON.parse(readFileSync(path, "utf8"));
    if (message.email === email) { unlinkSync(path); return message.code; }
  }
  throw Error("No llegó el código de pruebas.");
}

async function createBusiness(name) {
  const id = randomUUID();
  await request(businesses, 200, "POST", { id, name, industry: "grocery" });
  await activateBusiness(request, businesses + "/" + id);
  return businesses + "/" + id + "/commerce";
}

try {
  assert.equal((await request("/api/v1/health/database", 200)).status, "available");
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const scope = await createBusiness("Núcleo comercial de prueba");
  const secondary = await createBusiness("Negocio separado de prueba");
  const post = (body, status = 200, path = scope) => request(path + "/commands", status, "POST", { operationId: randomUUID(), ...body });
  const entry = (id) => request(scope + "/documents/" + id, 200);
  const stock = (id) => request(scope + "/products/" + id, 200);
  const cash = async (expected) => assert.equal((await request(scope + "/cash", 200)).session.expectedMinor, expected);
  const opening = await post({ kind: "open-cash", amountMinor: 100_000 });
  const product = { kind: "product", name: "Tabla QA", code: "TAB-QA", amountMinor: 10_000 };
  const first = (await post(product)).entityId;
  await post({ ...product, code: "tab-qa" }, 409);
  await request(secondary + "/products/" + first, 404);
  assert.equal((await request(scope + "/products/batch?ids=" + first + "," + first, 200)).length, 1);
  await request(secondary + "/products/batch?ids=" + first, 404);
  await request(scope + "/products/batch?ids=invalido", 400);
  const firstLine = { productId: first, quantity: 10, unitMinor: 5_000 };
  await post({ kind: "purchase", method: "cash", lines: [firstLine] }, 404, secondary);
  await post({ kind: "purchase", method: "cash", lines: [{ ...firstLine, quantity: 21 }] }, 409);
  assert.equal((await stock(first)).stock, 0);
  await cash(100_000);
  const purchase = await post({ kind: "purchase", method: "cash", lines: [firstLine] });
  assert.equal((await stock(first)).stock, 10);
  assert.equal((await entry(purchase.entityId)).totalMinor, 50_000);
  await cash(50_000);
  const sale = { operationId: randomUUID(), kind: "sale", method: "cash",
    lines: [{ productId: first, quantity: 2, unitMinor: 10_000 }] };

  const repeated = await Promise.all([post(sale), post(sale)]);
  assert.deepEqual(...repeated);
  await post({ ...sale, note: "contenido diferente" }, 409);
  await post(sale, 409, secondary);
  await request(secondary + "/commands/" + sale.operationId, 404);
  assert.deepEqual(await request(scope + "/commands/" + sale.operationId, 200), repeated[0]);
  const confirmed = await entry(repeated[0].entityId);
  assert.equal(confirmed.totalMinor, 20_000);
  assert.equal(confirmed.customerName, "Cliente ocasional");
  assert.equal(confirmed.lines[0].costMinor, 10_000);
  assert.equal((await stock(first)).stock, 8);
  const history = await request(scope + "/history?kind=sale", 200);
  assert.deepEqual(history.items.map((row) => row.totalMinor), [20_000]);
  await cash(70_000);
  console.log("Compra, venta ocasional, caja, número y consulta idempotente conciliados.");

  const returned = await post({ kind: "return", sourceId: confirmed.id, note: "Devolución parcial",
    method: "cash", lines: [{ productId: first, quantity: 1, restock: true }] });
  assert.equal((await entry(returned.entityId)).totalMinor, 10_000);
  assert.equal((await entry(confirmed.id)).lines[0].returnedQuantity, 1);
  assert.equal((await stock(first)).stock, 9);
  await post({ kind: "return", sourceId: confirmed.id, note: "Supera el resto",
    method: "cash", lines: [{ productId: first, quantity: 2 }] }, 409);
  const expense = await post({ kind: "expense", method: "cash", amountMinor: 2_000, note: "Material de oficina" });
  await cash(58_000);
  await post({ kind: "void-expense", sourceId: expense.entityId, note: "Motivo de anulación" });
  await post({ kind: "void-expense", sourceId: expense.entityId, note: "Segundo intento" }, 409);
  assert.equal((await entry(expense.entityId)).linked, true);
  await cash(60_000);
  console.log("Devolución parcial y anulación conservaron efectos e historial.");

  const last = (await post({ ...product, name: "Última unidad QA", code: "ULT-QA", amountMinor: 2_500 })).entityId;
  await post({ kind: "purchase", method: "transfer", lines: [{ productId: last, quantity: 1, unitMinor: 700 }] });
  const race = { kind: "sale", method: "qr", lines: [{ productId: last, quantity: 1, unitMinor: 2_500 }] };
  const incoming = await Promise.allSettled([post(race), post(race)]);
  assert.equal(incoming.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(incoming.find((result) => result.status === "rejected").reason.message, /hay 0 disponibles/);
  assert.equal((await stock(last)).stock, 0);

  const customer = (await post({ kind: "customer", name: "Cliente fiado" })).entityId;
  const credit = { kind: "sale", method: "credit", lines: [{ productId: first, quantity: 1, unitMinor: 10_000 }] };
  await post(credit, 400);
  const owed = await post({ ...credit, customerId: customer });
  assert.equal((await request(scope + "/debts", 200)).items[0].balanceMinor, 10_000);
  await post({ kind: "collect", sourceId: owed.entityId, method: "cash", amountMinor: 9_999 }, 409);
  const collected = await post({ kind: "collect", sourceId: owed.entityId, method: "cash", amountMinor: 10_000 });
  assert.equal((await entry(collected.entityId)).debtDeltaMinor, -10_000);
  assert.equal((await request(scope + "/debts?paid=true", 200)).items[0].balanceMinor, 0);
  await post({ kind: "stock-loss", note: "Rotura de prueba", lines: [{ productId: first, quantity: 1 }] });
  const report = (await request(scope + "/report", 200)).totals;
  assert.deepEqual([report.salesMinor, report.purchasesMinor, report.costMinor, report.expensesMinor, report.lossesMinor, report.resultMinor],
    [22_500, 50_700, 10_700, 0, 5_000, 6_800]);
  await cash(70_000);
  await post({ kind: "close-cash", sourceId: opening.entityId, amountMinor: 69_999 }, 400);
  await post({ kind: "close-cash", sourceId: opening.entityId, amountMinor: 70_000 });
  assert.ok((await request(scope + "/cash", 200)).session.closedAt);
  console.log("Carrera por la última unidad, fiado saldado, pérdida y resultado estimado verificados.");

  const line = [{ productId: first, quantity: 1, unitMinor: 10_000 }];
  const before = (await stock(first)).stock;
  const quote = await post({ kind: "quote", customerId: customer, lines: line });
  const quoted = await entry(quote.entityId);
  assert.ok(quoted.expiresOn);
  assert.equal((await stock(first)).stock, before);
  await post({ kind: "sale", sourceId: quote.entityId, customerId: customer, method: "transfer", lines: line });
  await post({ kind: "sale", sourceId: quote.entityId, customerId: customer, method: "transfer", lines: line }, 409);
  await post({ ...product, entityId: first, amountMinor: 12_000, name: "Nombre nuevo QA" });
  assert.equal((await entry(quote.entityId)).lines[0].name, "Tabla QA");
  assert.equal((await entry(quote.entityId)).totalMinor, 10_000);
  await post({ kind: "sale", method: "transfer", lines: line }, 409);
  console.log("Cotización sin reserva, conversión única, precio vigente y comprobante histórico verificados.");

  const cents = (await post({ kind: "product", name: "Redondeo QA", code: "CENT-QA", amountMinor: 1 })).entityId;
  await post({ kind: "purchase", method: "transfer", lines: [{ productId: cents, quantity: 1, unitMinor: 1 }] });
  await post({ kind: "purchase", method: "transfer", lines: [{ productId: cents, quantity: 2, unitMinor: 2 }] });
  const sold = await post({ kind: "sale", method: "qr", discountMinor: 1, lines: [{ productId: cents, quantity: 3, unitMinor: 1 }] });
  const amounts = [];
  for (const restock of [false, true, true]) {
    const back = await post({ kind: "return", sourceId: sold.entityId, method: "qr", note: "Prueba de redondeo",
      lines: [{ productId: cents, quantity: 1, restock }] });
    const document = await entry(back.entityId);
    amounts.push([document.totalMinor, document.lines[0].costMinor]);
  }
  assert.deepEqual(amounts, [[1, 2], [0, 1], [1, 2]]);
  assert.deepEqual([(await stock(cents)).stock, (await stock(cents)).valueMinor], [2, 3]);
  console.log("Las devoluciones repartieron exactamente centavos de importe y costo, separando la pieza dañada.");

  const summarize = async () => (await request(scope + "/report", 200)).totals;
  const baseline = await summarize();
  const moreCash = (await post({ kind: "open-cash", amountMinor: 2_000 })).entityId;
  const cashSessions = (await request(scope + "/cash/sessions", 200)).items;
  assert.deepEqual(cashSessions.map((row) => row.id), [moreCash, opening.entityId]);
  assert.equal(cashSessions[1].countedMinor, 70_000);
  assert.deepEqual((await request(secondary + "/cash/sessions", 200)).items, []);
  assert.deepEqual((await request(secondary + "/history?cashSession=" + opening.entityId, 200)).items, []);
  const salesJournal = (await request(scope + "/history?kind=sales", 200)).items;
  assert.ok(salesJournal.some((row) => row.kind === "sale") && salesJournal.some((row) => row.kind === "return"));
  assert.ok(salesJournal.every((row) => ["sale", "return", "exchange"].includes(row.kind)));
  const deposit = { operationId: randomUUID(), kind: "cash-adjust", sourceId: moreCash, code: "in",
    amountMinor: 1_200, note: "Aporte del titular" };
  await request(scope + "/commands", 422, "POST", deposit, false);
  assert.deepEqual(await post(deposit), await post(deposit));
  await cash(3_200);
  await post({ ...deposit, operationId: randomUUID(), code: "out", amountMinor: 3_201 }, 409);
  await post({ ...deposit, operationId: randomUUID(), code: "out", amountMinor: 200 });
  await cash(3_000);

  const adjustment = { operationId: randomUUID(), kind: "stock-in", note: "Ajuste de conteo QA",
    lines: [{ productId: cents, quantity: 3, unitMinor: 10 }] };
  await request(scope + "/commands", 422, "POST", adjustment, false);
  const added = await post(adjustment);
  await post(adjustment);
  assert.deepEqual([(await stock(cents)).stock, (await stock(cents)).valueMinor], [5, 33]);
  assert.equal((await entry(added.entityId)).totalMinor, 30);
  await post({ ...adjustment, operationId: randomUUID(), method: "cash" }, 400);
  assert.deepEqual(await summarize(), baseline);
  await cash(3_000);

  const manual = { kind: "manual-debt", customerId: customer, amountMinor: 1_500, note: "Saldo anterior" };
  const firstDebt = await post(manual);
  assert.ok((await request(scope + "/debts", 200)).items.find((row) => row.saleId === firstDebt.entityId)?.manual);
  await post({ kind: "collect", sourceId: firstDebt.entityId, method: "qr", amountMinor: 1_500 });
  await post({ kind: "void-debt", sourceId: firstDebt.entityId, note: "Ya fue cobrado" }, 409);
  const secondDebt = await post(manual);
  await post({ kind: "void-debt", sourceId: secondDebt.entityId, note: "Saldo duplicado" });
  assert.ok((await request(scope + "/debts?paid=true", 200)).items.find((row) => row.saleId === secondDebt.entityId)?.voided);
  assert.deepEqual(await summarize(), baseline);

  const from = confirmed.date;
  const filtered = await request(scope + "/history?" + new URLSearchParams({ kind: "documents", from, to: from, search: confirmed.number }), 200);
  assert.deepEqual(filtered.items.map((row) => row.id), [confirmed.id]);
  assert.equal((await request(secondary + "/history?search=" + confirmed.number, 200)).items.length, 0);
  await request(scope + "/history?from=2030-01-01&to=2000-01-01", 400);
  assert.deepEqual(await request(scope + "/setup", 200), { cashStarted: true, catalogReady: true, sold: true });
  console.log("Confirmados ajustes protegidos, fiado manual, filtros de documentos y avance inicial sin mezclar saldos ni negocios.");
  if (process.env.KHYPU_TEST_PLAYWRIGHT) {
    await (await import("./test-polish-browser.mjs")).checkPolish(cookies, scope.split("/").at(-2), confirmed.number, (await entry(purchase.entityId)).number);
  }
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
