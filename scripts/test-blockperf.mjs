import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { activateBusiness } from "./test-billing-fixture.mjs";

const api = "http://127.0.0.1:5183";
const auth = "/api/v1/auth";
const businessId = randomUUID();
const business = "/api/v1/businesses/" + businessId;
const scope = business + "/commerce";
const email = "perf-" + randomUUID() + "@example.test";
const password = "Cuenta ficticia para medir el comercio 2026!";
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const cookies = new Map();
let csrf;

async function request(path, expected, method = "GET", body) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", csrf ?? "");
    headers.set("Content-Type", "application/json");
  }
  headers.set("Cookie", [...cookies].map(([key, value]) => key + "=" + value).join("; "));
  const response = await fetch(api + path, { method, headers, body: JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const equal = pair.indexOf("=");
    cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
  const data = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
  assert.equal(response.status, expected, method + " " + path + " " + (data?.detail ?? ""));
  return data;
}

const post = (body) => request(scope + "/commands", 200, "POST", { operationId: randomUUID(), ...body });
const sql = (command) => execFileSync(process.env.KHYPU_TEST_PSQL, ["-X", "-w", "-h", "127.0.0.1", "-p", "5432",
  "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", command],
  { env: { ...process.env, PGPASSWORD: owner }, encoding: "utf8" });

const log = () => readFileSync(process.env.KHYPU_PERF_API_LOG, "utf8");
async function measure(name, action) {
  await action();
  await setTimeout(25);
  const times = [];
  const counts = [];
  for (let sample = 0; sample < 15; sample++) {
    const before = log().length;
    const start = performance.now();
    await action();
    times.push(performance.now() - start);
    await setTimeout(25);
    const statements = log().slice(before);
    counts.push([...(statements.matchAll(/Executed DbCommand/g))].length);
  }
  times.sort((left, right) => left - right);
  assert.ok(Math.min(...counts) > 0, "Faltan registros SQL en " + name);
  if (name === "carrito") assert.ok(Math.max(...counts) <= 10, "El carrito supera cinco consultas de datos más las cinco de ámbito");
  console.log(JSON.stringify({ name, medianMs: +times[7].toFixed(2), p95Ms: +times.at(-1).toFixed(2), sql: [...new Set(counts)] }));
}

try {
  csrf = (await request(auth + "/csrf", 200)).token;
  await request(auth + "/register/code", 204, "POST", { email });
  const mailbox = process.env.Email__MailboxPath;
  const code = readdirSync(mailbox).filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(mailbox, name), "utf8"))).find((message) => message.email === email)?.code;
  assert.ok(code, "Falta el código en el buzón aislado");
  await request(auth + "/register", 204, "POST", { email, password, code });
  await request(auth + "/login", 204, "POST", { email, password });
  csrf = (await request(auth + "/csrf", 200)).token;
  await request("/api/v1/businesses", 200, "POST", { id: businessId, name: "Maderas medición QA", industry: "timber", timberUnits: "imperial" });
  await activateBusiness(request, business);
  const products = [];
  for (let index = 0; index < 60; index++) {
    const { entityId } = await post({ kind: "product", name: "Tabla QA " + index, code: "PERF-" + index,
      amountMinor: 1000, timberProduct: { species: "Roble QA", superShortMinor: 1000, shortMinor: 1000, longMinor: 1000 } });
    products.push(entityId);
  }
  const lines = products.slice(0, 20).flatMap((productId) => [4, 5, 6, 7, 8].map((width) => ({
    productId, quantity: 2, unitMinor: 500, timber: { lengthMicros: 3_048_000_000, thicknessMicros: 50_800_000, widthMicros: width * 25_400_000 },
  })));
  await post({ kind: "purchase", method: "transfer", lines });
  await post({ kind: "sale", method: "transfer", lines: [{ ...lines[0], quantity: 1, unitMinor: 1000 }] });
  const get = (path) => request(scope + path, 200);
  await measure("inicio", () => Promise.all([get("/cash"), get("/report"), get("/setup")]));
  await measure("búsqueda", () => get("/products?search=Tabla&active=true"));
  await measure("almacén", () => get("/warehouse?search=Roble"));
  await measure("carrito", async () => {
    const availability = await request(scope + "/availability", 200, "POST", { lines });
    assert.equal(availability.length, 100);
    assert.equal(availability.find((item) => item.productId === lines[0].productId &&
      item.timber.widthMicros === lines[0].timber.widthMicros).available, 1);
  });
  await measure("informes", () => get("/report"));
  const batch = (select) => "ARRAY[" + lines.map(select).join(",") + "]";
  for (const [name, query] of [
    ["búsqueda", `SELECT "Id" FROM khypupyme.products WHERE "BusinessId"='${businessId}' AND "Name" ILIKE '%Tabla%' ORDER BY "Name", "Id" LIMIT 21`],
    ["movimientos del informe", `SELECT "Date" FROM khypupyme.commerce_entries WHERE "BusinessId"='${businessId}' AND "Date">=CURRENT_DATE-7`],
    ["medidas exactas", `SELECT "Stock" FROM khypupyme.timber_stock WHERE "BusinessId"='${businessId}' AND "ProductId"='${products[0]}' AND "LengthMicros"=3048000000 AND "ThicknessMicros"=50800000 AND "WidthMicros"=101600000`],
    ["medidas agrupadas", `SELECT stock."Stock" FROM unnest(${batch((line) => "'" + line.productId + "'")}::uuid[],
      ${batch((line) => line.timber.lengthMicros)}::bigint[], ${batch((line) => line.timber.thicknessMicros)}::bigint[],
      ${batch((line) => line.timber.widthMicros)}::bigint[]) AS request(product, length, thickness, width)
      JOIN khypupyme.timber_stock stock ON stock."BusinessId"='${businessId}' AND stock."ProductId"=request.product
      AND stock."LengthMicros"=request.length AND stock."ThicknessMicros"=request.thickness AND stock."WidthMicros"=request.width`],
  ]) {
    const [plan] = JSON.parse(sql("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query));
    const nodes = (node) => [{ operation: node["Node Type"], rows: node["Actual Rows"], loops: node["Actual Loops"],
      removed: node["Rows Removed by Filter"] ?? 0, index: node["Index Name"] }, ...(node.Plans ?? []).flatMap(nodes)];
    console.log(JSON.stringify({ name, explain: nodes(plan.Plan), blocks: plan.Plan["Shared Hit Blocks"] + plan.Plan["Shared Read Blocks"] }));
  }
  if (process.env.KHYPU_TEST_PLAYWRIGHT) {
    const { chromium } = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);
    const browser = await chromium.launch({ channel: "msedge", headless: true });
    try {
      const web = "http://127.0.0.1:5283";
      await request(business + "/selection", 204, "PUT");
      for (const [name, selector] of [["inicio", "Últimos siete días"], ["ventas", "Venta nueva"]]) {
        const samples = [];
        for (let sample = 0; sample < 5; sample++) {
          const context = await browser.newContext({ viewport: { width: 1440, height: 880 } });
          await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: web })));
          const page = await context.newPage();
          const start = performance.now();
          await page.goto(web + "/?vista=" + name);
          await page.getByRole("heading", { name: selector, exact: true }).waitFor();
          const ready = name === "ventas" ? page.getByRole("button", { name: /Tabla QA 0/ }) :
            page.getByRole("button", { name: "Abrir caja" });
          await ready.first().waitFor();
          samples.push(performance.now() - start);
          await context.close();
        }
        console.log(JSON.stringify({ name, medianUiMs: +samples.sort((a, b) => a - b)[2].toFixed(2), samples: samples.length }));
      }
    } finally { await browser.close(); }
  }
} finally {
  sql(`DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper('${email}');
    DELETE FROM khypupyme.email_challenges WHERE "Email"=upper('${email}');`);
}
