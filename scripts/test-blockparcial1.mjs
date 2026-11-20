import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { timberLabel } from "../web/src/timber/measures.ts";

const base = "http://127.0.0.1:5183";
const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const email = "parcial1-" + randomUUID() + "@example.test";
const password = randomUUID() + "!Aa4";
const businessId = randomUUID();
const business = businesses + "/" + businessId;
const scope = business + "/commerce";
const timber = { lengthMicros: 3_048_000_000, thicknessMicros: 50_800_000, widthMicros: 152_400_000 };
const cookies = new Map();
const evidenceDir = join(import.meta.dirname, "..", "artifacts", "parcial1");
const { chromium } = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);

async function request(path, expected, method = "GET", body) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", (await request(auth + "/csrf", 200)).token);
    if (body !== undefined) headers.set("Content-Type", "application/json");
  }
  if (cookies.size) headers.set("Cookie", [...cookies].map(([name, value]) => name + "=" + value).join("; "));
  const response = await fetch(base + path, { method, headers, body: JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const result = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
  assert.equal(response.status, expected, method + " " + path + (result?.detail ? " · " + result.detail : ""));
  return result;
}

function codeFromMailbox() {
  const directory = process.env.Email__MailboxPath;
  for (const item of readdirSync(directory).filter((file) => file.endsWith(".json"))) {
    const message = JSON.parse(readFileSync(join(directory, item), "utf8"));
    if (message.email === email) return message.code;
  }
  throw Error("No llegó el código ficticio al buzón temporal.");
}

const command = (value, status = 200) => request(scope + "/commands", status, "POST", { operationId: randomUUID(), ...value });
const line = (productId, quantity, unitMinor) => ({ productId, quantity, unitMinor, timber });
const getCash = () => request(scope + "/cash", 200);
const getStock = (productId) => request(scope + "/timber-stock/" + productId, 200);
const history = () => request(scope + "/history?kind=sale", 200);

let browser;
try {
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: codeFromMailbox(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  await request(businesses, 200, "POST", { id: businessId, name: "Sicomoro · Demostración", industry: "timber", timberUnits: "imperial" });
  await request(business + "/plan/trial", 204, "POST");
  await request(business + "/selection", 204, "PUT");
  const { entityId: productId } = await command({ kind: "product", name: "Tabla seca", code: "MAD-PARCIAL",
    timberProduct: { species: "Pino", superShortMinor: 800, shortMinor: 900, longMinor: 1000 } });
  assert.equal((await history()).items.length, 0);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: base })));
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const dialog = page.getByRole("dialog");
  const product = page.getByRole("button", { name: /Tabla seca.*Pino/ });

  await page.goto(base + "/?vista=caja");
  await page.getByLabel("Fondo inicial (Bs)").fill("1000");
  await page.getByRole("button", { name: "Confirmar apertura" }).click();
  await page.getByText("Caja abierta", { exact: true }).first().waitFor();
  assert.equal((await getCash()).session.openingMinor, 100_000);

  await page.goto(base + "/?vista=compras");
  await product.click();
  await page.getByLabel("Largo (pies)").fill("10");
  await page.getByLabel("Espesor (pulgadas)").fill("2");
  await page.getByLabel("Anchos (pulgadas)").fill("10x6");
  await page.getByLabel("Costo por pie tablar (Bs)").fill("5");
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await dialog.getByLabel("Forma de pago").selectOption("cash");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Confirmar compra" }).click();
  await page.getByRole("heading", { name: "Compra confirmada" }).waitFor();
  assert.match(await page.locator(".document-summary").innerText(), /500,00/);
  assert.equal((await getStock(productId)).items[0].stock, 10);
  assert.equal((await getCash()).session.expectedMinor, 50_000);

  async function chooseQuantity(quantity) {
    await page.goto(base + "/?vista=ventas");
    await product.click();
    await page.getByRole("button", { name: "Elegir medida disponible" }).click();
    await page.getByRole("button", { name: "Elegir " + timberLabel(timber, "imperial"), exact: true }).click();
    await page.getByLabel("Piezas de la medida elegida").fill(String(quantity));
  }

  await chooseQuantity(2);
  await page.getByText("Pedido 2 · Disponible 10", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Revisar venta" }).click();
  await dialog.getByLabel("Forma de pago").selectOption("cash");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Confirmar venta" }).click();
  await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();

  await page.reload();
  await page.getByRole("button", { name: "Historial de ventas", exact: true }).click();
  const sales = page.getByRole("table", { name: "Operaciones confirmadas" });
  const rows = sales.getByRole("row").filter({ hasText: /VEN-/ });
  await rows.first().waitFor();
  assert.equal(await rows.count(), 1);
  assert.match(await rows.first().innerText(), /200,00/);
  await rows.first().getByRole("button", { name: "Ver detalle" }).click();
  const sale = (await history()).items[0];
  await page.getByRole("heading", { name: sale.number }).waitFor();
  assert.match(await page.locator(".document-summary").innerText(), /200,00/);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar PDF" }).click();
  const download = await downloading;
  mkdirSync(evidenceDir, { recursive: true });
  const pdf = join(evidenceDir, "comprobante-sicomoro.pdf");
  await download.saveAs(pdf);
  assert.equal(readFileSync(pdf).subarray(0, 4).toString(), "%PDF");

  await page.goto(base + "/?vista=caja");
  const cashValue = page.locator(".cash-metrics div").filter({ hasText: "Efectivo esperado" });
  await cashValue.waitFor();
  assert.match(await cashValue.innerText(), /700,00/);
  const stock = await getStock(productId);
  assert.deepEqual(stock.items, [{ timber, stock: 8, valueMinor: 40_000 }]);
  const cash = await getCash();
  assert.equal(cash.session.expectedMinor, 70_000);

  await chooseQuantity(9);
  const shortage = "Pedido 9 · Disponible 8 · Faltan 1";
  await page.getByText(shortage, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Revisar venta" }).click();
  const confirm = dialog.getByRole("button", { name: "Confirmar venta" });
  const review = dialog.getByRole("checkbox");
  if (await review.isEnabled()) await review.check();
  assert.ok(await confirm.isDisabled());

  const moves = () => request(scope + "/warehouse/" + productId + "/movements", 200);
  const beforeMoves = await moves();
  const rejected = await command({ kind: "sale", method: "cash", lines: [line(productId, 9, 1000)] }, 409);
  assert.match(rejected.detail, /disponibles 8, faltan 1/);
  assert.deepEqual(await getStock(productId), stock);
  assert.deepEqual(await getCash(), cash);
  assert.deepEqual(await moves(), beforeMoves);
  const finalSales = await history();
  assert.equal(finalSales.items.length, 1);
  assert.equal(finalSales.items[0].number, sale.number);
  assert.equal(finalSales.items[0].totalMinor, 20_000);

  const evidence = {
    executedAt: new Date().toISOString(),
    environment: "PostgreSQL khypupyme2_test y Microsoft Edge",
    product: "Tabla seca · Pino · 2 pulgadas × 6 pulgadas × 10 pies",
    confirmed: { openingBOB: 1000, purchased: 10, paidBOB: 500, sold: 2, saleBOB: 200,
      stock: 8, cashBOB: 700, saleNumber: sale.number, saleCount: 1, pdf: "comprobante-sicomoro.pdf" },
    rejected: { onScreen: shortage, confirmDisabled: true, apiStatus: 409, stock: 8, cashBOB: 700,
      saleCount: 1, inventoryMovementCountBefore: beforeMoves.items.length, inventoryMovementCountAfter: (await moves()).items.length },
  };
  writeFileSync(join(evidenceDir, "resultado.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log("CA-01 APROBADO · " + sale.number + " · Bs 200 · stock 8 · Caja Bs 700 · PDF guardado");
  console.log("CA-02 APROBADO · 9 pedidas, 8 disponibles, 1 faltante · confirmación deshabilitada · HTTP 409 · sin movimientos nuevos");
} finally {
  try {
    await browser?.close();
  } finally {
    const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
      'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
    execFileSync(process.env.KHYPU_TEST_PSQL,
      ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
  }
}
