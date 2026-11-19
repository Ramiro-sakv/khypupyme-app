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
const email = "block7c-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque siete C 2026!";
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

const post = (scope, input, status = 200) => request(scope + "/commands", status, "POST", { operationId: randomUUID(), ...input });
const save = (scope, name, code, amountMinor, options) => post(scope, { kind: "product", name, code, amountMinor, ...options });
const document = (scope, item) => request(scope + "/documents/" + item.entityId, 200);
const product = (scope, id) => request(scope + "/products/" + id, 200);
const buy = (scope, lines, status = 200) => post(scope, { kind: "purchase", method: "transfer", lines }, status);
const sell = (scope, lines, status = 200) => post(scope, { kind: "sale", method: "qr", lines }, status);
const measured = (productId, quantity, unit, unitMinor, lot, expiresOn) =>
  ({ productId, quantity: 1, unitMinor, measure: { quantity, unit, lot, expiresOn } });
async function business(industry, name) {
  const id = randomUUID();
  await request(businesses, 200, "POST", { id, industry, name });
  await activateBusiness(request, businesses + "/" + id);
  return businesses + "/" + id + "/commerce";
}

const line = (productId, quantity, unitMinor) => ({ productId, quantity, unitMinor });
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" }).format(new Date());
try {
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const furniture = await business("furniture", "Muebles QA");
  const ceramics = await business("ceramics", "Cerámica QA");
  const cement = await business("cement", "Cemento QA");

  const dimensions = { widthCm: 90, depthCm: 50, heightCm: 75 };
  const desk = (await save(furniture, "Escritorio Ensayo", "M-1", 12000, { furnitureProduct: dimensions })).entityId;
  assert.deepEqual((await product(furniture, desk)).specialty.material.furniture, dimensions);
  await buy(furniture, [line(desk, 5, 8000)]);
  const furnitureLines = [line(desk, 2, 12000)];
  const offer = await post(furniture, { kind: "quote", lines: furnitureLines });
  assert.equal((await product(furniture, desk)).stock, 5);
  const saleInput = { kind: "sale", sourceId: offer.entityId, method: "qr", lines: furnitureLines, operationId: randomUUID() };
  const sale = await post(furniture, saleInput);
  assert.deepEqual(await post(furniture, saleInput), sale);
  assert.equal((await document(furniture, sale)).lines[0].details.specialty.material.furniture.widthCm, 90);
  assert.equal((await product(furniture, desk)).stock, 3);
  const delivery = { sourceId: sale.entityId };
  await post(furniture, { kind: "complete-delivery", ...delivery }, 409);
  await post(ceramics, { kind: "schedule-delivery", ...delivery, delivery: { mode: "pickup", day: today } }, 404);
  const otherFurniture = await business("furniture", "Muebles de otro local");
  await post(otherFurniture, { kind: "schedule-delivery", ...delivery, delivery: { mode: "pickup", day: today } }, 404);
  await post(furniture, { kind: "schedule-delivery", ...delivery, delivery: { mode: "pickup", day: today } });
  assert.equal((await document(furniture, sale)).delivery.mode, "pickup");
  const dispatch = { kind: "delivery-receipt", ...delivery, operationId: randomUUID() };
  await post(ceramics, dispatch, 404);
  const originalDispatch = await post(furniture, dispatch);
  assert.equal((await post(furniture, dispatch)).entityId, originalDispatch.entityId);
  await post(furniture, { kind: "schedule-delivery", ...delivery, delivery: { mode: "delivery", day: today } }, 400);
  await post(furniture, { kind: "schedule-delivery", ...delivery,
    delivery: { mode: "delivery", day: today, address: "Calle de prueba 1" } });
  const completion = { kind: "complete-delivery", ...delivery, operationId: randomUUID() };
  const completed = await post(furniture, completion);
  assert.deepEqual(await post(furniture, completion), completed);
  await post(furniture, { kind: "complete-delivery", ...delivery }, 409);
  assert.equal((await request(furniture + "/deliveries", 200)).items[0].completedOn, today);
  assert.equal((await document(furniture, sale)).delivery.address, "Calle de prueba 1");
  assert.match((await document(furniture, originalDispatch)).note, /Retiro en tienda/);
  assert.equal((await product(furniture, desk)).stock, 3);
  const secondSale = await sell(furniture, [line(desk, 1, 12000)]);
  await post(furniture, { kind: "schedule-delivery", sourceId: secondSale.entityId, delivery: { mode: "pickup", day: today } });
  await post(furniture, { kind: "prepare-delivery", sourceId: secondSale.entityId });
  assert.equal((await document(furniture, secondSale)).delivery.preparedOn, today);
  assert.equal((await request(furniture + "/deliveries?filter=prepared&mode=pickup", 200)).items[0].saleId, secondSale.entityId);
  assert.equal((await request(otherFurniture + "/deliveries?filter=today", 200)).items.length, 0);
  assert.equal((await request(furniture + "/deliveries?filter=completed&search=Calle", 200)).items[0].saleId, sale.entityId);
  assert.deepEqual(await request(furniture + "/delivery-attention", 200), { today: 1, overdue: 0, pending: 1, prepared: 1 });
  await post(furniture, { kind: "cancel-delivery", sourceId: secondSale.entityId, note: "El cliente cambió el retiro" });
  assert.equal((await document(furniture, secondSale)).delivery.cancelledOn, today);
  assert.equal((await request(furniture + "/deliveries?filter=pending", 200)).items.length, 0);
  assert.equal((await request(furniture + "/deliveries?filter=cancelled", 200)).items[0].saleId, secondSale.entityId);
  await post(furniture, { kind: "delivery-receipt", sourceId: secondSale.entityId }, 409);
  await post(furniture, { kind: "complete-delivery", sourceId: secondSale.entityId }, 409);
  assert.equal((await product(furniture, desk)).stock, 2);
  console.log("Muebles: 5 piezas; cotización conserva 5; venta deja 3; entrega completada conserva 3.");

  const tileProfile = { boxArea: 1.44, tone: "Arena", caliber: "C1" };
  const tile = (await save(ceramics, "Revestimiento Ensayo", "CE-1", 2000,
    { retailProduct: { unit: "piece", boxSize: 6, trackLots: false, reorder: 0 }, tileProduct: tileProfile })).entityId;
  await buy(ceramics, [measured(tile, "15", "box", 6000)]);
  const selection = { area: "12", waste: "10", tone: "Arena", caliber: "C1" };
  const covering = { ...measured(tile, "10", "box", 2000), tile: selection };
  const [tileCheck] = await request(ceramics + "/availability", 200, "POST", { quote: true, lines: [covering] });
  assert.deepEqual([tileCheck.requested, tileCheck.available], [60, 90]);
  await request(ceramics + "/availability", 400, "POST", { lines: [{ ...covering, tile: { ...selection, tone: "Otro" } }] });
  await sell(ceramics, [{ ...covering, tile: { ...selection, tone: null } }], 400);
  await sell(ceramics, [{ ...covering, tile: { ...selection, caliber: "C2" } }], 400);
  await sell(ceramics, [{ ...measured(tile, "9", "box", 2000), tile: selection }], 400);
  assert.equal((await product(ceramics, tile)).sellableStock, 90);
  const pieceOffer = await post(ceramics, { kind: "quote", lines: [{ ...measured(tile, "55", "piece", 2000), tile: selection }] });
  assert.equal((await document(ceramics, pieceOffer)).lines[0].quantity, 55);
  const tileOffer = await post(ceramics, { kind: "quote", lines: [covering] });
  const tileBill = await post(ceramics, { kind: "sale", method: "qr", sourceId: tileOffer.entityId, lines: [covering] });
  const tileLine = (await document(ceramics, tileBill)).lines[0];
  assert.equal(tileLine.quantity, 60);
  assert.equal(tileLine.details.measure.quantity, "10");
  assert.equal(tileLine.details.tile.requiredArea, 13.2);
  assert.equal(tileLine.details.tile.deliveredArea, 14.4);
  assert.equal((await product(ceramics, tile)).sellableStock, 30);
  console.log("Cerámica: 12 m² + 10 % requieren 10 cajas de 1,44 m² (14,4 m² entregados) o 55 piezas.");

  const bagSetup = { retailProduct: { unit: "piece", boxSize: 1, trackLots: true, reorder: 0 } };
  const bag = (await save(cement, "Cemento Ensayo", "C-50", 8000,
    { ...bagSetup, cementProduct: { bagKg: 50, bulkPriceMinor: 250 } })).entityId;
  const withoutBulk = (await save(cement, "Bolsa sin granel", "C-20", 5000,
    { ...bagSetup, cementProduct: { bagKg: 20, bulkPriceMinor: null } })).entityId;
  const bulk = (await product(cement, bag)).specialty.material.cement.bulkProductId;
  assert.ok(bulk);
  await buy(cement, [measured(bag, "4", "piece", 5000, "LOTE A"), measured(bag, "1", "piece", 5100, "VENCIDO", "2020-01-01")]);
  await buy(cement, [measured(bulk, "1", "kg", 250, "LOTE A")], 400);
  const opening = { kind: "open-cement", entityId: bag, stockQuantity: 2, code: "LOTE A", amountMinor: 10000, operationId: randomUUID() };
  await post(cement, { ...opening, operationId: randomUUID(), entityId: withoutBulk }, 400);
  await post(cement, { ...opening, operationId: randomUUID(), stockQuantity: 5 }, 409);
  await post(cement, { ...opening, operationId: randomUUID(), stockQuantity: 1, code: "VENCIDO" }, 409);
  await post(cement, { ...opening, operationId: randomUUID(), amountMinor: 9900 }, 409);
  await post(cement, { kind: "open-cash", amountMinor: 25000 });
  const cashBefore = await request(cement + "/cash", 200);
  const before = await request(cement + "/report", 200);
  const transfer = await post(cement, opening);
  assert.deepEqual(await post(cement, opening), transfer);
  const after = await request(cement + "/report", 200);
  assert.deepEqual(after, before);
  assert.deepEqual(await request(cement + "/cash", 200), cashBefore);
  const bagAfter = await product(cement, bag);
  const bulkAfter = await product(cement, bulk);
  assert.equal(bagAfter.measuredStock, 3);
  assert.equal(bagAfter.sellableStock, 2);
  assert.equal(bagAfter.valueMinor, 15100);
  assert.equal(bulkAfter.measuredStock, 100000);
  assert.equal(bulkAfter.valueMinor, 10000);
  const movement = await document(cement, transfer);
  assert.equal(movement.totalMinor, 0);
  const bulkEntry = movement.lines.find((entry) => entry.details.direction === "bulk-entry");
  assert.equal(bulkEntry.details.measure.lot, "LOTE A");
  assert.equal(bulkEntry.details.measure.quantity, "100");
  assert.equal(bulkEntry.subtotalMinor, 10000);
  assert.ok((await request(cement + "/warehouse/" + bulk + "/movements", 200)).items
    .some((row) => row.entryId === transfer.entityId && row.details.direction === "bulk-entry"));
  await sell(cement, [measured(bulk, "10", "kg", 250)]);
  await sell(cement, [measured(bag, "1", "piece", 8000)]);
  assert.equal((await product(cement, bulk)).measuredStock, 90000);
  assert.equal((await product(cement, bag)).sellableStock, 1);
  console.log("Cemento: abrir dos bolsas de 50 kg trasladó 100 kg y Bs 100 del lote sin cambiar el informe ni la caja.");

  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block7c-browser.mjs")).checkBrowser(cookies,
    Object.fromEntries(Object.entries({ furniture, ceramics, cement }).map(([key, path]) => [key, path.split("/").at(-2)])), password);
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
