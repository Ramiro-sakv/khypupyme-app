import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { authorizeFixture } from "./test-security-fixture.mjs";
import { captureTimber, timberVolume } from "../web/src/timber/measures.ts";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const base = "http://127.0.0.1:5183";
const mailbox = process.env.Email__MailboxPath;
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const email = "block5-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque cinco 2026!";
const cookies = new Map();

async function request(path, expected, method = "GET", body) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", (await request(auth + "/csrf", 200)).token);
    headers.set("Content-Type", "application/json");
  }
  if (cookies.size) headers.set("Cookie", [...cookies].map(([key, value]) => key + "=" + value).join("; "));
  await authorizeFixture(base, path, method, body, headers, password, request);
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


const inches = 25_400_000;
const feet = 304_800_000;
const d = (length, thickness, width) => ({ lengthMicros: length * feet, thicknessMicros: thickness * inches, widthMicros: width * inches });
const run = (scope, body, status = 200) => request(scope + "/commands", status, "POST", { operationId: randomUUID(), ...body });
const product = (name, species, code, rate = 1000) => ({ kind: "product", name, code,
  timberProduct: { species, superShortMinor: rate - 200, shortMinor: rate - 100, longMinor: rate } });
const line = (productId, quantity, unitMinor, timber) => ({ productId, quantity, unitMinor, timber });
const detail = (scope, entry) => request(scope + "/documents/" + entry.entityId, 200);
const stock = (scope, id, query = "") => request(scope + "/timber-stock/" + id + query, 200);

try {
  const sample = { units: "imperial", thickness: "2", length: "10", widths: "6, 10, 5, 3, 1, 3, 3" };
  const implicit = captureTimber(sample);
  assert.equal(implicit.error, "");
  assert.equal(implicit.rows.find((row) => row.timber.widthMicros === 3 * inches).quantity, 3);
  assert.equal(implicit.rows.reduce((sum, row) => sum + row.quantity, 0), 7);
  assert.equal(timberVolume(implicit.rows, "imperial"), "51,67");
  const multiplied = captureTimber({ ...sample, widths: "5x10, 4 X 7; 7×3" });
  assert.equal(multiplied.rows.reduce((sum, row) => sum + row.quantity, 0), 16);
  assert.equal(timberVolume(multiplied.rows, "imperial"), "165");
  assert.deepEqual(captureTimber({ ...sample, widths: "5.5, 3x" }).rows, []);
  assert.deepEqual(captureTimber({ ...sample, widths: "5.5" }).notices, ["Se utilizará ancho 5″."]);
  assert.deepEqual(captureTimber({ units: "metric", thickness: "50.8", length: "3048", widths: "152.4" }).rows[0].timber, d(10, 2, 6));
  console.log("Captura: 7 piezas y 51,67 pies tablares; 16 piezas y 165 pies tablares; equivalencia métrica exacta.");

  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const business = businesses + "/" + randomUUID();
  await request(businesses, 200, "POST", { id: business.split("/").at(-1), name: "Sicomoro QA", industry: "timber", timberUnits: "imperial" });
  await request(business + "/plan/trial", 204, "POST");
  const scope = business + "/commerce";
  await run(scope, { kind: "open-cash", amountMinor: 100_000 });
  const pine = (await run(scope, product("Tabla seca", "Pino", "PI-001"))).entityId;
  const oak = (await run(scope, product("Tabla cepillada", "Roble", "RO-001", 2200))).entityId;
  const pine6 = d(10, 2, 6), pine4 = d(10, 2, 4), oak7 = d(5, 1.5, 7);
  const demonstration = (await run(scope, product("Costo por pie tablar", "Roble", ""))).entityId;
  assert.match((await request(scope + "/products/" + demonstration, 200)).code, /^MAD-\d{6}$/);
  const newBuys = [[4, 5, 6, 7], [6, 7, 8, 9]];
  for (const [index, widths] of newBuys.entries()) {
    const lines = widths.map((width) => ({ ...line(demonstration, 1, 1100, d(10, 2, width)), timberCostUnit: "board-foot" }));
    const amount = [40_333, 55_000][index];
    const board = await run(scope, { kind: "purchase", method: "transfer", lines });
    const invoice = await detail(scope, board);
    assert.equal(invoice.totalMinor, amount);
    assert.equal(invoice.lines.reduce((sum, row) => sum + row.costMinor, 0), amount);
    assert.ok(invoice.lines.every((row) => row.unitMinor === 1100 && row.details.timberCostUnit === "board-foot"));
  }
  assert.equal((await request(scope + "/products/" + demonstration, 200)).valueMinor, 95_333);
  const repeated = await request(scope + "/availability", 200, "POST", { lines: [
    line(demonstration, 1, 1100, d(10, 2, 4)), line(demonstration, 3, 1100, d(10, 2, 4)),
  ] });
  assert.deepEqual(repeated.map((row) => [row.requested, row.available]), [[4, 1]]);
  assert.equal((await request(scope + "/warehouse/" + demonstration + "/movements", 200)).items.length, 8);
  console.log("Compra de madera por volumen: Bs 403,33 y Bs 550,00, costo acumulado, movimientos y faltante agrupado.");
  const purchased = await run(scope, { kind: "purchase", method: "cash", lines: [line(pine, 10, 5000, pine6)] });
  assert.equal((await detail(scope, purchased)).totalMinor, 50_000);
  const sale = await run(scope, { kind: "sale", method: "cash", lines: [line(pine, 2, 1000, pine6)] });
  assert.equal((await detail(scope, sale)).totalMinor, 20_000);
  assert.deepEqual((await stock(scope, pine)).items, [{ timber: pine6, stock: 8, valueMinor: 40_000 }]);
  assert.equal((await request(scope + "/cash", 200)).session.expectedMinor, 70_000);
  assert.equal((await request(scope + "/products?search=Pino", 200)).items[0].name, "Tabla seca");
  console.log("Sicomoro: compró 10 a Bs 50, vendió 2 por Bs 200 y quedaron 8 de 2″ × 6″ × 10′.");

  await run(scope, { kind: "purchase", method: "transfer", lines: [line(pine, 3, 5000, pine4), line(oak, 5, 6000, oak7)] });
  const rejected = await run(scope, { kind: "sale", method: "cash", lines: [line(pine, 1, 1000, pine6), line(pine, 4, 1000, pine4)] }, 409);
  assert.match(rejected.detail, /4″.*disponibles 3, faltan 1/);
  assert.equal((await stock(scope, pine, "?length=" + pine6.lengthMicros + "&thickness=" + pine6.thicknessMicros + "&widths=" + pine6.widthMicros)).items[0].stock, 8);
  assert.equal((await request(scope + "/cash", 200)).session.expectedMinor, 70_000);
  assert.deepEqual((await stock(scope, pine)).items.map((row) => row.timber), [pine4, pine6]);

  const mixed = await run(scope, { kind: "sale", method: "transfer",
    lines: [line(pine, 2, 1000, pine4), line(oak, 1, 2100, oak7), line(pine, 1, 1000, pine6)] });
  const invoice = await detail(scope, mixed);
  assert.equal(invoice.totalMinor, 32_521);
  assert.equal(invoice.lines.length, 3);
  assert.deepEqual(new Set(invoice.lines.map((row) => row.species)), new Set(["Pino", "Roble"]));
  const original = invoice.lines.find((row) => row.timber.widthMicros === pine4.widthMicros);
  const returned = await run(scope, { kind: "return", method: "transfer", note: "Devolución de la medida original", sourceId: invoice.id,
    lines: [{ productId: pine, originalLineId: original.lineId, quantity: 1, restock: true }] });
  assert.equal((await detail(scope, returned)).lines[0].costMinor, 5000);
  assert.deepEqual((await stock(scope, pine)).items.map((row) => row.stock), [2, 7]);
  assert.equal((await detail(scope, mixed)).lines.find((row) => row.lineId === original.lineId).returnedQuantity, 1);
  await run(scope, { kind: "return", method: "transfer", note: "Excede lo vendido", sourceId: invoice.id,
    lines: [{ productId: pine, originalLineId: original.lineId, quantity: 2 }] }, 409);
  console.log("Venta mixta de dos especies y tres medidas, devolución parcial por línea y faltante por ancho comprobados.");

  const quote = await run(scope, { kind: "quote", lines: implicit.rows.map((row) => line(oak, row.quantity, 2200, row.timber)) });
  assert.equal((await detail(scope, quote)).totalMinor, 113_667);
  const exact = await run(scope, { kind: "quote", lines: [line(oak, 1, 2200, d(10, 2, 1)), line(oak, 1, 2200, d(10, 2, 4))] });
  assert.equal((await detail(scope, exact)).totalMinor, 18_333);
  await request(business + "/settings", 204, "PUT", { businessId: business.split("/").at(-1), timberUnits: "metric" });
  assert.equal((await detail(scope, sale)).timberUnits, "imperial");
  const inMetric = await run(scope, { kind: "quote", lines: [line(pine, 2, 1000, pine6)] });
  assert.equal((await detail(scope, inMetric)).timberUnits, "metric");
  assert.equal((await detail(scope, inMetric)).totalMinor, 20_000);
  const custom = { ...line(pine, 1, 1250, pine6), timberRateManual: true };
  const cut = (await run(scope, { kind: "product", name: "Corte QA", code: "CORTE-QA", amountMinor: 500, serviceProduct: true })).entityId;
  await run(scope, { kind: "quote", lines: [line(pine, 1, 1250, pine6)] }, 409);
  const mixedRate = [custom, line(cut, 1, 500)];
  const negotiated = await run(scope, { kind: "quote", lines: mixedRate });
  const proposed = await detail(scope, negotiated);
  assert.equal(proposed.totalMinor, 13_000);
  assert.equal(proposed.lines.find((row) => row.productId === pine).details.timberCatalogMinor, 1000);
  const converted = await run(scope, { kind: "sale", sourceId: proposed.id, method: "qr", lines: mixedRate });
  const document = await detail(scope, converted);
  assert.equal(document.lines.find((row) => row.productId === pine).unitMinor, 1250);
  assert.equal(document.lines.find((row) => row.productId === cut).details.isService, true);
  assert.equal((await request(scope + "/products/" + cut, 200)).stock, 0);
  assert.equal((await request(scope + "/products/" + pine, 200)).timber.longMinor, 1000);
  const long = await request(scope + "/timber-stock/" + pine + "?category=long&width=" + pine6.widthMicros, 200);
  assert.deepEqual(long.items.map((row) => row.timber), [pine6]);
  assert.equal((await request(scope + "/timber-stock/" + pine + "?category=short", 200)).items.length, 0);
  console.log("Tarifa pactada conservada al convertir, catálogo intacto y filtros exactos por medidas.");
  console.log("Tarifas por largo, prorrateo del centavo y presentación histórica confirmados.");

  const practice = business + "/practice";
  const originalStock = (await stock(scope, pine)).items;
  const session = async () => (await request(practice, 200)).session;
  const control = (action, revision, status = 200) => request(practice, status, "POST", { action, revision });
  const started = (await control("start", null)).session;
  const sandbox = businesses + "/" + started.sandboxId;
  const fictional = sandbox + "/practice-commerce";
  assert.equal((await request(businesses, 200)).items.length, 1);
  await request(sandbox, 404);
  await request(sandbox + "/selection", 404, "PUT");
  await request(sandbox + "/commerce/products", 404);
  await request(business + "/practice-commerce/products", 404);
  await run(business + "/practice-commerce", { kind: "open-cash", amountMinor: 1 }, 404);
  await run(sandbox + "/commerce", { kind: "open-cash", amountMinor: 1 }, 404);
  const practiceCash = await run(fictional, { kind: "open-cash", amountMinor: 13_000 });
  assert.equal((await session()).step, 1);
  await control("pause", started.revision, 409);
  await control("pause", (await session()).revision);
  await run(fictional, product("Otra tabla", "Cedro", "QA-FICT"), 409);
  const resumed = (await control("resume", (await session()).revision)).session;
  assert.equal(resumed.sandboxId, started.sandboxId);
  assert.equal(resumed.step, 1);
  const fiction = (await run(fictional, product("Otra tabla", "Cedro", "QA-FICT"))).entityId;
  const sandboxPurchase = await run(fictional, { kind: "purchase", method: "qr", lines: [line(fiction, 4, 123, d(3, 1, 5))] });
  assert.equal((await detail(fictional, sandboxPurchase)).practice, true);
  const sandboxSale = await run(fictional, { kind: "sale", method: "qr", lines: [line(fiction, 3, 900, d(3, 1, 5))] });
  const originalFiction = (await detail(fictional, sandboxSale)).lines[0];
  await run(fictional, { kind: "return", sourceId: sandboxSale.entityId, method: "qr", note: "Pieza de muestra",
    lines: [{ productId: fiction, originalLineId: originalFiction.lineId, quantity: 1 }] });
  assert.equal((await session()).step, 5);
  await control("reports-seen", (await session()).revision);
  await run(fictional, { kind: "close-cash", sourceId: practiceCash.entityId, amountMinor: 13_000 });
  assert.equal((await session()).step, 7);
  assert.equal((await control("finish", (await session()).revision)).session.state, "completed");
  await request(fictional + "/products", 404);
  await request(fictional + "/commands/" + sandboxSale.operationId, 404);
  assert.deepEqual((await stock(scope, pine)).items, originalStock);
  assert.equal((await detail(scope, sale)).totalMinor, 20_000);
  const restart = (await control("start", (await session()).revision)).session;
  assert.notEqual(restart.sandboxId, started.sandboxId);
  await control("abandon", restart.revision);
  console.log("Práctica: pausada, reanudada, completada, limpiada y reiniciada sin tocar el negocio real.");
  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block5-browser.mjs")).checkBrowser(cookies,
    originalStock.find((row) => row.timber.widthMicros === pine6.widthMicros).stock);
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
