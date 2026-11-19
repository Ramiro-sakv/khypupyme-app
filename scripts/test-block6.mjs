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
const email = "block6-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque seis 2026!";
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
const line = (productId, quantity, unitMinor, serials) => ({ productId, quantity, unitMinor, serials });
const dateFormat = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" });
const date = (days) => dateFormat.format(new Date(Date.now() + days * 86_400_000));

async function business(industry, name) {
  const id = randomUUID();
  await request(businesses, 200, "POST", { id, industry, name });
  await activateBusiness(request, businesses + "/" + id);
  return businesses + "/" + id + "/commerce";
}

try {
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const store = await business("convenience", "Tienda 24 QA");
  const clothes = await business("clothing", "Ropa QA");
  const appliances = await business("appliances", "Electrodomésticos QA");

  const codeBatch = await Promise.all(["Primero", "Segundo"].map((name) => save(store, name, "", 600,
    { retailProduct: { unit: "piece", boxSize: 1, trackLots: false, reorder: 0 } })));
  const autoCodes = await Promise.all(codeBatch.map((item) => product(store, item.entityId)));
  assert.deepEqual(autoCodes.map((item) => item.code).sort(), ["TIE-000001", "TIE-000002"]);
  const clientRequest = { operationId: randomUUID(), kind: "customer", name: "Cliente con código" };
  const client = await post(store, clientRequest);
  assert.deepEqual(await post(store, clientRequest), client);
  assert.equal((await request(store + "/customers?search=CLI-000001", 200)).items[0].id, client.entityId);
  assert.equal((await request(clothes + "/customers?search=CLI-000001", 200)).items.length, 0);
  const soda = (await save(store, "Soda", "BEB-24", 500, {
    retailProduct: { unit: "piece", boxSize: 24, reorder: 43, trackLots: true },
  })).entityId;
  const purchase = await buy(store, [measured(soda, "1", "box", 8000, "PRIMERO", date(7)),
    measured(soda, "1", "box", 9000, "SEGUNDO", date(60)), measured(soda, "10", "piece", 200, "VENCIDO", date(-2))]);
  assert.equal((await document(store, purchase)).totalMinor, 19_000);
  assert.equal((await request(store + "/products/code?code=beb-24", 200)).id, soda);
  assert.equal((await product(store, soda)).sellableStock, 48);
  assert.equal((await product(store, soda)).measuredStock, 58);
  assert.equal((await request(store + "/attention", 200)).expiring, 1);
  const sale = await sell(store, [measured(soda, "5", "piece", 500)]);
  const sold = await document(store, sale);
  assert.equal(sold.totalMinor, 2500);
  assert.deepEqual(sold.lines[0].details.lots.map((row) => row.lot), ["PRIMERO"]);
  assert.equal((await product(store, soda)).sellableStock, 43);
  assert.ok((await request(store + "/products?attention=reorder", 200)).items.some((item) => item.id === soda));
  assert.equal((await request(store + "/lots/" + soda, 200)).items.find((row) => row.lot === "VENCIDO").sellable, false);
  assert.match((await sell(store, [measured(soda, "44", "piece", 500)], 409)).detail, /disponible 43/);
  assert.equal((await product(store, soda)).sellableStock, 43);
  const shortage = await request(store + "/availability", 200, "POST", {
    lines: [measured(soda, "25", "piece", 500), measured(soda, "19", "piece", 500)],
  });
  assert.deepEqual(shortage.map((row) => [row.requested, row.available]), [[44, 43]]);
  assert.match(shortage[0].reason, /vencidas/);
  await request(clothes + "/availability", 404, "POST", { lines: [measured(soda, "1", "piece", 500)] });
  await request(clothes + "/warehouse/" + soda + "/movements", 404);
  const warehouse = await request(store + "/warehouse?search=BEB-24&status=available", 200);
  assert.equal(warehouse.items[0].product.id, soda);
  await post(store, { kind: "hold-lot", entityId: soda, code: "SEGUNDO", note: "Sello por verificar" });
  assert.equal((await request(store + "/warehouse?attention=held", 200)).items[0].product.id, soda);
  await post(store, { kind: "release-lot", entityId: soda, code: "SEGUNDO", note: "Sello confirmado" });
  const spoilage = await post(store, { kind: "stock-loss", note: "Lote vencido", lines: [measured(soda, "2", "piece", 0, "VENCIDO")] });
  assert.equal((await document(store, spoilage)).totalMinor, 400);
  assert.equal((await product(store, soda)).sellableStock, 43);
  console.log("Tienda: 2 cajas de 24 − 5 = 43 vendibles; lote más próximo primero; vencidos excluidos y visibles para pérdida.");

  const rice = (await save(store, "Arroz suelto", "AR", 22_000, {
    retailProduct: { unit: "kg", boxSize: 1, reorder: 0.5, trackLots: false },
  })).entityId;
  const juice = (await save(store, "Jugo suelto", "JU", 800, { retailProduct: { unit: "l", boxSize: 1, reorder: 0, trackLots: false } })).entityId;
  await buy(store, [measured(rice, "2", "kg", 14_000), measured(juice, "3", "l", 300)]);
  const weightsSale = await sell(store, [measured(rice, "1", "lb", 22_000), measured(juice, "500", "ml", 800)]);
  let invoice = await document(store, weightsSale);
  assert.equal(invoice.totalMinor, 10_379);
  assert.equal(invoice.lines.find((item) => item.productId === rice).details.baseQuantity, 453.59237);
  assert.equal((await product(store, rice)).sellableStock, 1546.40763);
  assert.equal((await product(store, juice)).sellableStock, 2500);
  const riceLine = invoice.lines.find((item) => item.productId === rice);
  const moved = await post(store, { kind: "return", sourceId: invoice.id, method: "qr", note: "Media libra",
    lines: [{ ...measured(rice, "0.5", "lb"), originalLineId: riceLine.lineId }] });
  assert.equal((await product(store, rice)).sellableStock, 1773.203815);
  assert.equal((await document(store, moved)).totalMinor, 4990);
  assert.equal((await document(store, weightsSale)).lines.find((item) => item.productId === rice).returnedBaseQuantity, 226.796185);
  await sell(store, [measured(juice, "1", "kg", 800)], 400);
  console.log("Conversiones exactas: kg/lb, L/mL, tarifa por unidad de ficha y devolución parcial.");

  const variant = (size, color) => ({ apparelProduct: { model: "Polera Andina", size, color } });
  const small = (await save(clothes, "Polera", "POL-S", 10_000, variant("S", "Azul"))).entityId;
  const large = (await save(clothes, "Polera", "POL-L", 12_000, variant("L", "Azul"))).entityId;
  const medium = (await save(clothes, "Polera", "POL-M", 11_000, variant("M", "Negro"))).entityId;
  await post(clothes, { kind: "product", name: "Duplicado", code: "POL-2", amountMinor: 12_000,
    ...variant("l", "azul") }, 409);
  await buy(clothes, [line(small, 2, 4000), line(large, 1, 5000), line(medium, 2, 4500)]);
  assert.deepEqual((await request(clothes + "/variants?model=Polera+Andina", 200)).map((item) => item.apparel.size), ["L", "M", "S"]);
  const original = await sell(clothes, [line(small, 2, 10_000)]);
  const originalLine = (await document(clothes, original)).lines[0];
  const exchange = { kind: "exchange", sourceId: original.entityId, method: "qr", note: "Talla diferente",
    lines: [{ productId: small, originalLineId: originalLine.lineId, quantity: 2 }], exchangeLines: [line(large, 2, 12_000)] };
  await post(clothes, exchange, 409);
  assert.equal((await product(clothes, small)).stock, 0);
  assert.equal((await document(clothes, original)).lines[0].returnedQuantity, 0);
  const changed = await post(clothes, { ...exchange, amountMinor: 2000,
    lines: [{ ...exchange.lines[0], quantity: 1 }], exchangeLines: [line(large, 1, 12_000)] });
  const exchangeDoc = await document(clothes, changed);
  assert.equal(exchangeDoc.totalMinor, 2000);
  assert.equal((await product(clothes, small)).stock, 1);
  assert.equal((await product(clothes, large)).stock, 0);
  assert.equal((await document(clothes, original)).lines[0].returnedQuantity, 1);
  assert.deepEqual(new Set(exchangeDoc.lines.map((row) => row.details.direction)), new Set(["returned", "replacement"]));
  console.log("Ropa: matriz, combinación duplicada rechazada, cambio sin stock revertido y diferencia de Bs 20 confirmada.");

  const fridge = (await save(appliances, "Refrigerador", "REF-1", 220_000, { equipmentProduct: { warrantyMonths: 12 } })).entityId;
  await buy(appliances, [line(fridge, 2, 100_000, ["EQ-001", "eq-001"])], 409);
  await buy(appliances, [line(fridge, 2, 100_000, ["EQ-001", "EQ-002"])]);
  const receiving = await request(appliances + "/availability", 200, "POST", { receiving: true, lines: [line(fridge, 2, 0, ["EQ-002", "NUEVA"])] });
  assert.equal(receiving.find((item) => item.serial === "EQ-002").reason, "Serie ya registrada");
  assert.equal(receiving.find((item) => item.serial === "NUEVA").available, 1);
  await buy(appliances, [line(fridge, 1, 100_000, ["eq-001"])], 409);
  assert.equal((await product(appliances, fridge)).stock, 2);
  const quote = await post(appliances, { kind: "quote", lines: [line(fridge, 1, 220_000)] });
  const soldUnit = await post(appliances, { kind: "sale", method: "qr", sourceId: quote.entityId,
    lines: [line(fridge, 1, 220_000, ["EQ-001"])] });
  const serial = () => request(appliances + "/serial?serial=eq-001", 200);
  const before = await serial();
  assert.equal(before.unit.state, "sold");
  assert.ok(before.unit.warrantyUntil > date(0));
  await sell(appliances, [line(fridge, 1, 220_000, ["eq-001"])], 409);
  const unitLine = (await document(appliances, soldUnit)).lines[0];
  assert.equal(unitLine.details.warrantyUntil, before.unit.warrantyUntil);
  await post(appliances, { kind: "return", sourceId: soldUnit.entityId, method: "qr", note: "Revisar unidad", lines: [
    { productId: fridge, originalLineId: unitLine.lineId, quantity: 1 },
  ] });
  assert.equal((await serial()).unit.state, "inspection");
  const isolated = await request(appliances + "/availability", 200, "POST", { lines: [line(fridge, 1, 0, ["EQ-001"])] });
  assert.equal(isolated[0].available, 0);
  assert.equal(isolated[0].reason, "En inspección");
  assert.equal((await request(appliances + "/attention", 200)).inspections, 1);
  assert.equal((await request(appliances + "/report", 200)).stockValueMinor, 200_000);
  assert.equal((await request(appliances + "/serials?state=available", 200)).items.length, 1);
  await sell(appliances, [line(fridge, 1, 220_000, ["EQ-001"])], 409);
  await post(appliances, { kind: "inspection", serial: "EQ-001", release: true, note: "Funciona correctamente" });
  await post(appliances, { kind: "inspection", serial: "EQ-001", release: true, note: "Repetida" }, 409);
  assert.equal((await product(appliances, fridge)).stock, 2);
  const after = await serial();
  assert.deepEqual(after.movements.map((item) => item.kind), ["released", "return", "sale", "purchase"]);
  assert.equal(after.movements[2].warrantyUntil, before.unit.warrantyUntil);
  await request(store + "/serial?serial=eq-001", 404);
  const claim = { kind: "warranty", serial: "EQ-001", sourceId: soldUnit.entityId, note: "Revisión solicitada" };
  await post(appliances, { ...claim, code: "resolved" }, 409);
  await post(appliances, { ...claim, serial: "EQ-002", code: "open" }, 404);
  await post(appliances, { ...claim, code: "open" });
  await post(appliances, { ...claim, code: "open" }, 409);
  await post(appliances, { ...claim, code: "resolved", note: "Se completó la revisión" });
  assert.deepEqual((await serial()).movements.slice(0, 2).map((item) => item.kind), ["warranty-resolved", "warranty-open"]);
  assert.equal((await serial()).unit.state, "available");
  const variants = [{ id: randomUUID(), code: "MATRIZ-1", size: "S", color: "Verde", amountMinor: 1500 },
    { id: randomUUID(), code: "MATRIZ-2", size: "M", color: "Azul", amountMinor: 2500 }];
  const batch = { kind: "variants", code: "Modelo conjunto", name: "Modelo conjunto", operationId: randomUUID() };
  await post(clothes, { ...batch, variants: [variants[0], { ...variants[1], code: "matriz-1" }] }, 409);
  assert.equal((await request(clothes + "/variants?model=Modelo%20conjunto", 200)).length, 0);
  const saved = await post(clothes, { ...batch, variants });
  assert.deepEqual(await post(clothes, { ...batch, variants }), saved);
  assert.deepEqual((await request(clothes + "/variants?model=Modelo%20conjunto", 200)).map((row) => row.stock), [0, 0]);
  console.log("Electrodomésticos: duplicados bloqueados, venta por serie, garantía en historial, inspección y liberación aisladas.");
  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block6-browser.mjs")).checkBrowser(cookies,
    { store: store.split("/").at(-2), clothes: clothes.split("/").at(-2), appliances: appliances.split("/").at(-2) }, password);
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
