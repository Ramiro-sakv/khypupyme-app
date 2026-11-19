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
const email = "block7a-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque siete 2026!";
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
  const grocery = await business("grocery", "Abarrotes QA");
  const beverages = await business("beverages", "Bebidas QA");
  const cosmetics = await business("cosmetics", "Cosméticos QA");
  const pets = await business("pets", "Mascotas QA");

  const salt = (await save(grocery, "Sal de mesa", "SAL-24", 150, {
    retailProduct: { unit: "piece", boxSize: 24, trackLots: true, reorder: 5 },
  })).entityId;
  await buy(grocery, [measured(salt, "1", "box", 2400, "LARGO", date(60)), measured(salt, "1", "box", 2400, "PRONTO", date(7)),
    measured(salt, "10", "piece", 100, "VENCIDO", date(-1))]);
  const grocerySale = await sell(grocery, [measured(salt, "5", "piece", 150)]);
  assert.equal((await product(grocery, salt)).sellableStock, 43);
  const [groceryCheck] = await request(grocery + "/availability", 200, "POST",
    { lines: [measured(salt, "45", "piece", 150)] });
  assert.deepEqual([groceryCheck.requested, groceryCheck.available], [45, 43]);
  const groceryDoc = await document(grocery, grocerySale);
  assert.equal(groceryDoc.totalMinor, 750);
  assert.deepEqual(groceryDoc.lines[0].details.lots.map((row) => row.lot), ["PRONTO"]);
  await sell(grocery, [measured(salt, "44", "piece", 150)], 409);
  console.log("Abarrotes: dos cajas de 24 − 5 = 43 vendibles; salida por vencimiento y lote vencido excluido.");

  const soda = (await save(beverages, "Soda retornable", "BOT-24", 200,
    { retailProduct: { unit: "piece", boxSize: 24, trackLots: false, reorder: 5 } })).entityId;
  const combined = (boxes, loose, price) => {
    const row = measured(soda, boxes, "box", price);
    return { ...row, measure: { ...row.measure, loose } };
  };
  const receiving = await buy(beverages, [combined("2", 3, 2400)]);
  assert.equal((await document(beverages, receiving)).totalMinor, 5100);
  assert.equal((await product(beverages, soda)).sellableStock, 51);
  const [beverageCheck] = await request(beverages + "/availability", 200, "POST", { lines: [combined("1", 2, 200)] });
  assert.deepEqual([beverageCheck.requested, beverageCheck.available], [26, 51]);
  const stock = await post(beverages, { kind: "container-stock", name: "Botella retornable", stockQuantity: 10 });
  const containerId = (await request(beverages + "/containers", 200))[0].typeId;
  assert.equal((await document(beverages, stock)).containers[0].added, 10);
  const customerId = (await post(beverages, { kind: "customer", name: "Cliente ficticio QA" })).entityId;
  const moves = (delivered, returned) => [{ typeId: containerId, delivered, returned }];
  const bottleSale = { operationId: randomUUID(), kind: "sale", customerId, method: "qr", lines: [combined("1", 2, 200)], containers: moves(4, 0) };
  const beverageSale = await post(beverages, bottleSale);
  assert.deepEqual(await post(beverages, bottleSale), beverageSale);
  const beverageDoc = await document(beverages, beverageSale);
  assert.equal(beverageDoc.totalMinor, 5200);
  assert.equal(beverageDoc.lines[0].details.baseQuantity, 26);
  assert.equal(beverageDoc.lines[0].details.measure.loose, 2);
  assert.equal(beverageDoc.containers[0].customerBalance, 4);
  const supply = () => request(beverages + "/containers?customer=" + customerId, 200);
  await post(beverages, { ...bottleSale, operationId: randomUUID(), lines: [combined("0", 2, 200)], containers: moves(3, 5) }, 409);
  assert.equal((await product(beverages, soda)).sellableStock, 25);
  assert.equal((await supply())[0].customerBalance, 4);
  await post(beverages, { kind: "containers", customerId, containers: moves(9, 2) }, 409);
  await post(beverages, { kind: "containers", customerId, containers: moves(8, 2) });
  assert.equal((await supply())[0].available, 0);
  assert.equal((await supply())[0].customerBalance, 10);
  await post(beverages, { kind: "containers", customerId, containers: moves(0, 3) });
  assert.equal((await supply())[0].customerBalance, 7);
  const pendingContainers = await request(beverages + "/container-obligations", 200);
  assert.deepEqual(pendingContainers.items.map((row) => [row.customerId, row.quantity]), [[customerId, 7]]);
  assert.equal((await request(beverages + "/container-obligations?search=no-coincide", 200)).items.length, 0);
  assert.equal((await request(grocery + "/container-obligations", 200)).items.length, 0);
  const groceryAttention = await request(grocery + "/attention", 200);
  assert.equal(groceryAttention.expired, 1);
  assert.equal(groceryAttention.expiring, 1);
  assert.equal((await supply())[0].available, 3);
  assert.equal((await request(beverages + "/report", 200)).totals.salesMinor, 5200);
  assert.equal((await request(grocery + "/containers", 200)).length, 0);
  await request(grocery + "/containers?customer=" + customerId, 404);
  console.log("Bebidas: caja + sueltos, venta y envases idempotentes, rechazo del exceso sobre saldo previo, devolución independiente.");

  const makeup = (await save(cosmetics, "Labial", "COS-CO", 4000, {
    retailProduct: { unit: "piece", boxSize: 1, trackLots: true, reorder: 1 },
    cosmeticProduct: { brand: "Nativa", presentation: "Barra 4 g", tone: "Coral", afterOpeningMonths: 12 },
  })).entityId;
  for (const text of ["nativa", "barra 4 g", "coral"])
    assert.equal((await request(cosmetics + "/products?search=" + encodeURIComponent(text), 200)).items[0].id, makeup);
  await buy(cosmetics, [measured(makeup, "3", "piece", 2000, "C-17", date(20))]);
  assert.equal((await request(cosmetics + "/warehouse?search=coral", 200)).items[0].product.cosmetic.afterOpeningMonths, 12);
  assert.equal((await request(cosmetics + "/lots/" + makeup, 200)).items[0].expiresOn, date(20));
  const correct = (kind, note, status = 200) => post(cosmetics, { kind, entityId: makeup, code: "C-17", note }, status);
  await correct("hold-lot", "", 400);
  const hold = await correct("hold-lot", "Revisar empaque");
  const held = await product(cosmetics, makeup);
  assert.deepEqual([held.measuredStock, held.sellableStock, held.valueMinor], [3, 0, 6000]);
  assert.equal((await document(cosmetics, hold)).note, "Revisar empaque");
  assert.equal((await request(cosmetics + "/lots/" + makeup, 200)).items[0].held, true);
  assert.equal((await request(cosmetics + "/warehouse?status=unavailable&attention=held", 200)).items[0].product.id, makeup);
  assert.equal((await request(cosmetics + "/attention", 200)).held, 1);
  await sell(cosmetics, [measured(makeup, "1", "piece", 4000)], 409);
  await correct("release-lot", "Empaque revisado");
  assert.equal((await product(cosmetics, makeup)).sellableStock, 3);
  await correct("hold-lot", "Daño detectado");
  const discard = await correct("discard-lot", "Sello roto");
  assert.equal((await document(cosmetics, discard)).totalMinor, 6000);
  assert.equal((await product(cosmetics, makeup)).measuredStock, 0);
  assert.equal((await request(cosmetics + "/report", 200)).totals.lossesMinor, 6000);
  await buy(cosmetics, [measured(makeup, "2", "piece", 2000, "C-VISUAL", date(20))]);
  console.log("Cosméticos: búsqueda por tres atributos, apartado conserva valor, liberación y baja total con motivo.");

  await post(pets, { kind: "product", name: "Alimento sin lote", code: "AL-NO", amountMinor: 2000,
    retailProduct: { unit: "kg", boxSize: 1, reorder: 0, trackLots: false } }, 400);
  const food = (await save(pets, "Alimento a granel", "AL-01", 2000,
    { retailProduct: { unit: "kg", boxSize: 1, reorder: 0.3, trackLots: true } })).entityId;
  await buy(pets, [measured(food, "2", "kg", 900, "BOLSA-A", date(10)), measured(food, "1", "kg", 1000, "BOLSA-B", date(30))]);
  const packageOrigin = await sell(pets, [measured(food, "0.5", "kg", 2000, "BOLSA-B")]);
  const petsDoc = await document(pets, packageOrigin);
  assert.equal(petsDoc.totalMinor, 1000);
  assert.deepEqual(petsDoc.lines[0].details.lots, [{ lot: "BOLSA-B", expiresOn: date(30), quantity: 500, costMinor: 500 }]);
  assert.deepEqual((await request(pets + "/lots/" + food + "?lot=BOLSA-B&sellable=true", 200)).items.map((x) => x.quantity), [500]);
  const [petCheck] = await request(pets + "/availability", 200, "POST",
    { lines: [measured(food, "0.3", "kg", 2000, "bolsa-b"), measured(food, "0.3", "kg", 2000, "BOLSA-B")] });
  assert.deepEqual([petCheck.lot, petCheck.requested, petCheck.available], ["BOLSA-B", 600, 500]);
  await sell(pets, [measured(food, "0.6", "kg", 2000, "BOLSA-B")], 409);
  assert.equal((await product(pets, food)).sellableStock, 2500);
  console.log("Mascotas: fraccionamiento con lote elegido, vencimiento y costo de la bolsa de origen, rechazo del faltante de ese lote.");
  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block7a-browser.mjs")).checkBrowser(cookies,
    { grocery: grocery.split("/").at(-2), beverages: beverages.split("/").at(-2),
      cosmetics: cosmetics.split("/").at(-2), pets: pets.split("/").at(-2) }, password);
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
