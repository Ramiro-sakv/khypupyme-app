import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { activateBusiness } from "./test-billing-fixture.mjs";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { authorizeFixture } from "./test-security-fixture.mjs";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const base = "http://127.0.0.1:5183";
const mailbox = process.env.Email__MailboxPath;
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const email = "block7b-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque siete B 2026!";
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

const line = (productId, quantity, unitMinor, serials) => ({ productId, quantity, unitMinor, serials });
const detail = (reference, measure = "", shelf = "", brand = "", model = "") =>
  ({ detailProduct: { reference, measure, shelf, brand, model } });
try {
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const footwear = await business("footwear", "Calzado QA");
  const electronics = await business("electronics", "Electrónica QA");
  const hardware = await business("hardware", "Ferretería QA");
  const parts = await business("spareParts", "Repuestos QA");
  const stationery = await business("stationery", "Librería QA");

  // Huellas guardadas por clientes de los bloques 6 y 7A, antes de estos campos opcionales.
  async function verifyLegacyDigest(scope, input, extended) {
    const command = { operationId: randomUUID(), kind: "product", ...input };
    await post(scope, command);
    const old = {
      OperationId: command.operationId, Kind: "product", EntityId: null, CustomerId: null, SourceId: null,
      Name: command.name, Code: command.code, Phone: null, Method: null, Note: null,
      AmountMinor: command.amountMinor, DiscountMinor: null, Active: null, Lines: null, TimberProduct: null,
      RetailProduct: { Unit: command.retailProduct.unit, BoxSize: command.retailProduct.boxSize,
        TrackLots: command.retailProduct.trackLots, Reorder: command.retailProduct.reorder },
      ApparelProduct: null, EquipmentProduct: null, ExchangeLines: null, Serial: null, Release: null,
      ...(extended ? { CosmeticProduct: { Brand: command.cosmeticProduct.brand, Presentation: command.cosmeticProduct.presentation, Tone: null },
        Containers: null, StockQuantity: null } : {}),
    };
    const expected = createHash("sha256").update(JSON.stringify(old)).digest("hex").toUpperCase();
    const sql = 'SELECT "Digest" FROM khypupyme.commerce_receipts WHERE "Id"=\'' + command.operationId + '\';';
    const stored = execFileSync(process.env.KHYPU_TEST_PSQL, ["-X", "-w", "-h", "127.0.0.1", "-p", "5432",
      "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-t", "-A", "-c", sql],
      { env: { ...process.env, PGPASSWORD: owner }, encoding: "utf8" }).trim();
    assert.equal(stored, expected);
  }
  await verifyLegacyDigest(hardware, { name: "Legacy6", code: "OLD6", amountMinor: 100,
    retailProduct: { unit: "piece", boxSize: 12, trackLots: false, reorder: 0 } }, false);
  const legacy = await business("cosmetics", "Compatibilidad de contratos QA");
  await verifyLegacyDigest(legacy, { name: "Legacy7A", code: "OLD7A", amountMinor: 100,
    retailProduct: { unit: "piece", boxSize: 1, trackLots: true, reorder: 0 },
    cosmeticProduct: { brand: "Legacy", presentation: "10 ml" } }, true);
  console.log("Contratos anteriores: huellas idempotentes de los bloques 6 y 7A conservadas.");

  const variant = (size) => ({ apparelProduct: { model: "Zapato Andino", size, color: "Negro" } });
  const forty = (await save(footwear, "Zapato", "Z-40", 15_000, variant("40"))).entityId;
  const fortyOne = (await save(footwear, "Zapato", "Z-41", 15_000, variant("41"))).entityId;
  const fortyTwo = (await save(footwear, "Zapato", "Z-42", 16_000, variant("42"))).entityId;
  await buy(footwear, [line(forty, 2, 7000), line(fortyTwo, 1, 7500)]);
  const originalSale = await sell(footwear, [line(forty, 1, 15_000)]);
  const original = (await document(footwear, originalSale)).lines[0];
  assert.equal(original.details.specialty.countUnit, "pair");
  const exchange = { kind: "exchange", sourceId: originalSale.entityId, method: "qr", note: "Cambio de talla",
    lines: [{ productId: forty, originalLineId: original.lineId, quantity: 1 }],
    exchangeLines: [line(fortyOne, 1, 15_000)], amountMinor: 0 };
  await post(footwear, exchange, 409);
  assert.equal((await product(footwear, forty)).stock, 1);
  assert.equal((await document(footwear, originalSale)).lines[0].returnedQuantity, 0);
  const changed = await post(footwear, { ...exchange, operationId: randomUUID(),
    exchangeLines: [line(fortyTwo, 1, 16_000)], amountMinor: 1000 });
  assert.equal((await document(footwear, changed)).totalMinor, 1000);
  assert.equal((await product(footwear, forty)).stock, 2);
  assert.equal((await product(footwear, fortyTwo)).stock, 0);
  assert.equal((await request(footwear + "/report", 200)).totals.salesMinor, 16_000);
  assert.equal((await request(footwear + "/variants?model=Zapato+Andino", 200)).length, 3);
  console.log("Calzado: pares por talla/color, cambio rechazado sin stock y diferencia de Bs 10 registrada.");

  const cable = (await save(electronics, "Cable USB", "USB-C", 2500, detail("USB-C-2M", "", "", "Andino", "C2"))).entityId;
  const tablet = (await save(electronics, "Tableta", "TAB-S", 80_000,
    { ...detail("TAB-10", "", "", "Andino", "T10"), equipmentProduct: { warrantyMonths: 12 } })).entityId;
  await buy(electronics, [line(cable, 5, 1000), line(tablet, 2, 40_000, ["EL-001", "EL-002"])]);
  await buy(electronics, [line(tablet, 1, 40_000, ["el-001"])], 409);
  const mixed = await sell(electronics, [line(cable, 2, 2500), line(tablet, 1, 80_000, ["EL-001"])]);
  const mixedDoc = await document(electronics, mixed);
  assert.equal(mixedDoc.totalMinor, 85_000);
  const unit = mixedDoc.lines.find((row) => row.productId === tablet);
  assert.equal(unit.details.serial, "EL-001");
  assert.equal(unit.details.specialty.detail.brand, "Andino");
  await post(electronics, { kind: "return", sourceId: mixed.entityId, method: "qr", note: "Inspección",
    lines: [{ productId: tablet, originalLineId: unit.lineId, quantity: 1 }] });
  await sell(electronics, [line(tablet, 1, 80_000, ["EL-001"])], 409);
  const [inspection] = await request(electronics + "/availability", 200, "POST", { lines: [line(tablet, 1, 0, ["el-001"])] });
  assert.deepEqual([inspection.serial, inspection.available, inspection.reason], ["EL-001", 0, "En inspección"]);
  await post(electronics, { kind: "inspection", serial: "EL-001", release: true, note: "Equipo revisado" });
  const history = await request(electronics + "/serial?serial=EL-001", 200);
  assert.deepEqual(history.movements.map((row) => row.kind), ["released", "return", "sale", "purchase"]);
  assert.ok(history.movements[2].warrantyUntil);
  assert.equal((await request(electronics + "/products?search=T10", 200)).items[0].id, tablet);
  console.log("Electrónica: accesorio y equipo en un comprobante; serie duplicada, garantía e inspección verificadas.");

  const wire = (await save(hardware, "Cable flexible", "CAB-4", 500, { ...detail("CF-4", "4 mm²", "A-03"),
    retailProduct: { unit: "m", boxSize: 1, trackLots: false, reorder: 10, rollLength: 50 } })).entityId;
  const wireBuy = await buy(hardware, [measured(wire, "2", "roll", 10_000)]);
  assert.equal((await document(hardware, wireBuy)).lines[0].details.baseQuantity, 100);
  assert.equal((await product(hardware, wire)).sellableStock, 100);
  const wireSale = await sell(hardware, [measured(wire, "12.5", "m", 500)]);
  assert.equal((await document(hardware, wireSale)).totalMinor, 6250);
  assert.equal((await product(hardware, wire)).sellableStock, 87.5);
  for (const search of ["CF-4", "4 mm²", "A-03"])
    assert.equal((await request(hardware + "/warehouse?search=" + encodeURIComponent(search), 200)).items[0].product.id, wire);
  await buy(hardware, [measured(wire, "0.5", "roll", 10_000)], 400);
  const before = await product(hardware, wire);
  await sell(hardware, [measured(wire, "88", "m", 500)], 409);
  assert.deepEqual(await product(hardware, wire), before);
  const wireLine = (await document(hardware, wireSale)).lines[0];
  await post(hardware, { kind: "return", sourceId: wireSale.entityId, method: "qr", note: "Metros sin usar",
    lines: [{ ...measured(wire, "2.5", "m"), originalLineId: wireLine.lineId }] });
  assert.equal((await product(hardware, wire)).sellableStock, 90);
  const wireQuote = await post(hardware, { kind: "quote", lines: [measured(wire, "0.125", "m", 500)] });
  assert.equal((await document(hardware, wireQuote)).totalMinor, 63);
  console.log("Ferretería: 2 rollos de 50 m → 100 m; venta de 12,5 m y devolución de 2,5 m → 90 m; búsqueda y redondeo exactos.");

  const fitment = (brand, model, fromYear, toYear, confirmed = true) => ({ brand, model, fromYear, toYear, confirmed });
  const filter = (await save(parts, "Filtro de aceite", "FIL-1", 4500, { ...detail("OEM-001", "Rosca M20"),
    partsProduct: { equivalents: ["EQ-100", "AB-200"], compatibility: [
      fitment("Toyota", "Hilux", 2010, 2015), fitment("Nissan", "Frontier", 2018, 2020, false),
    ] } })).entityId;
  const uncertain = (await save(parts, "Correa", "COR-1", 3500,
    { ...detail("COR-001"), partsProduct: { equivalents: [], compatibility: [] } })).entityId;
  await buy(parts, [line(filter, 3, 2000), line(uncertain, 2, 1500)]);
  for (const search of ["OEM-001", "eq-100", "AB-200"])
    assert.equal((await request(parts + "/products?search=" + encodeURIComponent(search), 200)).items[0].id, filter);
  const fit = (brand, model, year) => request(parts + "/products?" + new URLSearchParams({ vehicleBrand: brand, vehicleModel: model, year: String(year) }), 200);
  assert.equal((await fit("toyota", "hilux", 2010)).items[0].id, filter);
  assert.equal((await fit("Toyota", "Hilux", 2015)).items[0].id, filter);
  assert.equal((await fit("Toyota", "Hilux", 2016)).items.length, 0);
  assert.equal((await request(parts + "/warehouse?vehicleBrand=Toyota&vehicleModel=Hilux&year=2015&search=EQ-100", 200)).items[0].product.id, filter);
  assert.equal((await request(parts + "/warehouse?vehicleBrand=Toyota&vehicleModel=Hilux&year=2016&search=EQ-100", 200)).items.length, 0);
  assert.equal((await fit("Toyota", "Frontier", 2019)).items.length, 0);
  assert.equal((await fit("Nissan", "Frontier", 2019)).items[0].specialty.parts.compatibility[1].confirmed, false);
  await request(parts + "/products?year=1899", 400);
  await request(hardware + "/products/" + filter, 404);
  const partSale = await sell(parts, [line(filter, 1, 4500), line(uncertain, 1, 3500)]);
  const savedParts = (await document(parts, partSale)).lines.find((row) => row.productId === filter).details.specialty.parts;
  await post(parts, { kind: "product", entityId: filter, name: "Filtro corregido", code: "FIL-1", amountMinor: 4500,
    ...detail("OEM-NUEVO"), partsProduct: { equivalents: ["EQ-NUEVO"], compatibility: [fitment("Toyota", "Hilux", 2021, 2024)] } });
  assert.deepEqual((await document(parts, partSale)).lines.find((row) => row.productId === filter).details.specialty.parts, savedParts);
  assert.equal((await fit("Toyota", "Hilux", 2012)).items.length, 0);
  assert.equal((await request(parts + "/products?search=EQ-NUEVO", 200)).items[0].id, filter);
  console.log("Repuestos: equivalencias, rangos inclusivos, filtro en una sola compatibilidad, aviso pendiente e histórico conservado.");

  const pencil = (await save(stationery, "Lápiz", "LAP-1", 150)).entityId;
  const print = (await save(stationery, "Impresión A4", "IMP-A4", 50, { printingProduct: { paperSize: "A4", color: "bw" } })).entityId;
  await buy(stationery, [line(pencil, 10, 50)]);
  await buy(stationery, [line(print, 1, 50)], 400);
  const job = { copies: 3, facesPerCopy: 5, duplex: true };
  const printLine = { ...line(print, 1, 50), printing: job };
  const bill = await sell(stationery, [line(pencil, 2, 150), printLine]);
  const billDoc = await document(stationery, bill);
  assert.equal(billDoc.totalMinor, 1050);
  const printed = billDoc.lines.find((row) => row.productId === print);
  assert.deepEqual(printed.details.printing, { profile: { paperSize: "A4", color: "bw" }, job, faces: 15, sheets: 9 });
  assert.equal(printed.quantity, 15);
  assert.equal(printed.costMinor, 0);
  assert.equal((await product(stationery, print)).stock, 0);
  assert.equal((await product(stationery, pencil)).stock, 8);
  const quote = await post(stationery, { kind: "quote", lines: [printLine] });
  await post(stationery, { kind: "sale", sourceId: quote.entityId, method: "qr",
    lines: [{ ...printLine, printing: { copies: 5, facesPerCopy: 3, duplex: true } }] }, 409);
  await post(stationery, { kind: "sale", sourceId: quote.entityId, method: "qr", lines: [printLine] });
  const printReturn = { kind: "return", sourceId: bill.entityId, method: "qr", note: "Caras defectuosas",
    lines: [{ productId: print, originalLineId: printed.lineId, quantity: 2 }] };
  await post(stationery, printReturn, 400);
  const refund = await post(stationery, { ...printReturn, lines: [{ ...printReturn.lines[0], restock: false }] });
  assert.equal((await document(stationery, refund)).totalMinor, 100);
  await sell(stationery, [{ ...printLine, printing: { copies: 0, facesPerCopy: 5, duplex: true } }], 400);
  const single = await post(stationery, { kind: "quote", lines: [{ ...printLine, printing: { ...job, duplex: false } }] });
  const double = await document(stationery, single);
  assert.equal(double.totalMinor, 750);
  assert.equal(double.lines[0].details.printing.sheets, 15);
  console.log("Librería: artículos e impresión por tarifa; 3 copias de 5 caras a doble cara = 15 caras y 9 hojas; total Bs 10,50.");

  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block7b-browser.mjs")).checkBrowser(cookies,
    Object.fromEntries(Object.entries({ footwear, electronics, hardware, parts, stationery }).map(([key, path]) => [key, path.split("/").at(-2)])));
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
