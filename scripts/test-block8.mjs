import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { authorizeFixture } from "./test-security-fixture.mjs";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const base = "http://127.0.0.1:5183";
const mailbox = process.env.Email__MailboxPath;
const { owner } = JSON.parse(readFileSync(0, "utf8"));
const email = "block8-api-" + randomUUID() + "@example.test";
const otherEmail = "block8-other-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque ocho 2026!";
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
  if (Array.isArray(expected)) {
    assert.ok(expected.includes(response.status), method + " " + path + " · " + response.status + " · " + result?.detail);
    return { status: response.status, result };
  }
  assert.equal(response.status, expected, method + " " + path + (result?.detail ? " · " + result.detail : ""));
  return result;
}

function readCode(recipient = email) {
  for (const item of readdirSync(mailbox).filter((file) => file.endsWith(".json"))) {
    const path = join(mailbox, item);
    const message = JSON.parse(readFileSync(path, "utf8"));
    if (message.email === recipient) { unlinkSync(path); return message.code; }
  }
  throw Error("No llegó el código de pruebas.");
}

const len30 = 30 * 24 * 60 * 60 * 1000;
const elapsed = (start, end) => Date.parse(end) - Date.parse(start);
const modifier = "SET LOCAL TIME ZONE 'UTC'; ";
const database = (sql) => execFileSync(process.env.KHYPU_TEST_PSQL,
  ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", modifier + sql],
  { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "pipe", "pipe"] });
const create = async (name, id = randomUUID()) => (await request(businesses, 200, "POST", { id, industry: "grocery", name })).id;
const read = (id) => request(businesses + "/" + id + "/plan", 200);
const activate = (id, status = 204) => request(businesses + "/" + id + "/plan/trial", status, "POST");
const begin = (id, planId, cardId, attemptId = randomUUID(), status = 200, extras = {}) =>
  request(businesses + "/" + id + "/plan/attempts", status, "POST", { id: attemptId, planId, cardId, ...extras });
const run = (id, attempt, action, status = 200) => request(businesses + "/" + id + "/plan/attempts/" + attempt, status, "POST", { action });
const commercial = (id, path, status = 200) => request(businesses + "/" + id + "/commerce" + path, status);
const command = (id, input, status = 200) =>
  request(businesses + "/" + id + "/commerce/commands", status, "POST", { operationId: randomUUID(), ...input });

try {
  await request(auth + "/register/code", 204, "POST", { email });
  await request(auth + "/register", 204, "POST", { email, code: readCode(), password });
  await request(auth + "/login", 204, "POST", { email, password });
  const first = await create("Primer negocio de prueba");
  const secondary = await create("Negocio de pases de prueba");
  const browserBusiness = await create("Negocio de checkout visual");
  assert.equal((await read(first)).firstBusiness, true);
  assert.equal((await read(secondary)).firstBusiness, false);
  await activate(secondary, 409);
  await command(first, { kind: "open-cash", amountMinor: 10000 }, 403);
  const toggleEmail = (confirmed) => database("UPDATE khypupyme.\"AspNetUsers\" SET \"EmailConfirmed\"=" + confirmed +
    " WHERE \"NormalizedEmail\"=upper('" + email + "');");
  toggleEmail(false);
  assert.equal((await read(first)).emailVerified, false);
  await activate(first, 403);
  toggleEmail(true);
  const started = Date.now();
  await Promise.all([activate(first), activate(first)]);
  const firstPlan = await read(first);
  assert.equal(firstPlan.active, true);
  assert.equal(firstPlan.trialUsed, true);
  assert.ok(Math.abs(Date.parse(firstPlan.trialUntil) - started - len30) < 5000);
  await activate(first);
  assert.equal((await read(first)).trialUntil, firstPlan.trialUntil);
  assert.equal((await read(secondary)).active, false);
  console.log("Prueba: correo verificado, primer negocio, dos activaciones simultáneas y 30 días sin ampliación.");

  const opening = await command(first, { kind: "open-cash", amountMinor: 10000 });
  const product = (await command(first, { kind: "product", name: "Termo de prueba", code: "TER", amountMinor: 5000 })).entityId;
  await command(first, { kind: "purchase", method: "transfer", lines: [{ productId: product, unitMinor: 2500, quantity: 2 }] });
  const saleInput = { operationId: randomUUID(), kind: "sale", method: "cash", lines: [{ productId: product, unitMinor: 5000, quantity: 1 }] };
  const sale = await command(first, saleInput);
  assert.equal((await commercial(first, "/cash")).session.expectedMinor, 15000);
  if (process.env.KHYPU_TEST_WINDOWS) {
    await (await import("./test-pilot-windows.mjs")).checkWindows({ email, password, business: first });
    await command(first, { kind: "purchase", method: "transfer", lines: [{ productId: product, unitMinor: 2500, quantity: 1 }] });
  }

  const options = (await read(secondary)).plans.map(({ id, amountMinor, days, months }) => [id, amountMinor, days, months]);
  assert.deepEqual(options, [["30-days", 3900, 30, 0], ["6-months", 21000, 0, 6], ["1-year", 39000, 0, 12]]);
  await begin(secondary, "30-days", "desconocida", randomUUID(), 400);
  await begin(secondary, "30-days", "demo-visa", randomUUID(), 400, { cardNumber: "dato-no-admitido", cvv: "000" });
  const pendingId = randomUUID();
  const pending = await begin(secondary, "6-months", "demo-visa", pendingId);
  assert.equal(pending.state, "pending");
  assert.equal(pending.amountMinor, 21000);
  assert.equal(pending.card.lastFour, "4242");
  assert.equal(elapsed(pending.createdAt, pending.expiresAt), 15 * 60 * 1000);
  assert.deepEqual((await read(secondary)).payments[0], pending);
  assert.deepEqual(await begin(secondary, "6-months", "demo-visa", pendingId), pending);
  await begin(secondary, "1-year", "demo-visa", randomUUID(), 409);
  await run(first, pending.id, "confirm", 404);
  assert.equal((await run(secondary, pending.id, "cancel")).state, "cancelled");
  assert.equal((await run(secondary, pending.id, "confirm")).state, "cancelled");
  const declined = await begin(secondary, "30-days", "demo-declined");
  assert.equal((await run(secondary, declined.id, "confirm")).state, "declined");
  assert.equal((await read(secondary)).active, false);
  const expired = await begin(secondary, "30-days", "demo-visa");
  database("UPDATE khypupyme.demo_payments SET \"ExpiresAt\"=now()-interval '1 second' WHERE \"Id\"='" + expired.id + "';");
  assert.equal((await read(secondary)).payments[0].state, "expired");
  assert.equal((await run(secondary, expired.id, "confirm")).state, "expired");
  const simulated = await begin(secondary, "1-year", "demo-visa");
  assert.equal((await run(secondary, simulated.id, "expire")).state, "expired");
  assert.equal((await read(secondary)).active, false);
  console.log("Checkout: pendiente recuperado, rechazo, cancelación y vencimientos sin vigencia; selección cruzada y campos de tarjeta rechazados.");

  const payable = await begin(secondary, "30-days", "demo-visa");
  const confirmed = await Promise.all([run(secondary, payable.id, "confirm"), run(secondary, payable.id, "confirm")]);
  const pass30 = confirmed[0];
  assert.deepEqual(confirmed[0], confirmed[1]);
  assert.equal(elapsed(pass30.accessFrom, pass30.accessUntil), len30);
  assert.equal((await read(secondary)).accessUntil, pass30.accessUntil);
  const sixAttempt = await begin(secondary, "6-months", "demo-mastercard");
  const six = await run(secondary, sixAttempt.id, "confirm");
  assert.equal(six.accessFrom, pass30.accessUntil);
  const annualAttempt = await begin(secondary, "1-year", "demo-visa");
  const annual = await run(secondary, annualAttempt.id, "confirm");
  assert.equal(annual.accessFrom, six.accessUntil);
  assert.equal((await read(secondary)).accessUntil, annual.accessUntil);
  await run(secondary, six.id, "refund");
  let afterRefund = await read(secondary);
  assert.equal(afterRefund.payments.find(({ id }) => id === annual.id).accessFrom, pass30.accessUntil);
  assert.equal(afterRefund.active, true);
  assert.equal((await run(secondary, six.id, "refund")).state, "refunded");
  assert.equal((await read(secondary)).accessUntil, afterRefund.accessUntil);
  await run(secondary, pass30.id, "refund");
  afterRefund = await read(secondary);
  assert.equal(afterRefund.active, true);
  assert.ok(Date.parse(afterRefund.payments.find(({ id }) => id === annual.id).accessFrom) <= Date.now());
  await run(secondary, annual.id, "refund");
  assert.equal((await read(secondary)).active, false);
  assert.equal((await read(first)).trialUntil, firstPlan.trialUntil);
  assert.equal((await commercial(secondary, "/cash")).session, null);
  assert.equal((await commercial(secondary, "/history")).items.length, 0);
  assert.equal((await commercial(secondary, "/report")).totals.salesMinor, 0);
  console.log("Vigencias: confirmación simultánea idempotente, pases acumulados y reembolsos que preservan los otros periodos.");

  // Un ancla futura de QA verifica el día local en los finales de mes de un año bisiesto.
  const future = (await run(secondary, (await begin(secondary, "30-days", "demo-visa")).id, "confirm"));
  database("UPDATE khypupyme.demo_payments SET \"AccessUntil\"='2032-09-01T03:30:00Z' WHERE \"Id\"='" + future.id + "';");
  const anchored = await read(secondary);
  const estimateSix = anchored.plans.find(({ id }) => id === "6-months").estimatedEnd;
  assert.equal(new Date(estimateSix).toISOString(), "2033-03-01T03:30:00.000Z"); // 31 ago → 28 feb en Bolivia.
  database("UPDATE khypupyme.demo_payments SET \"AccessUntil\"='2032-03-01T03:30:00Z' WHERE \"Id\"='" + future.id + "';");
  const estimateYear = (await read(secondary)).plans.find(({ id }) => id === "1-year").estimatedEnd;
  assert.equal(new Date(estimateYear).toISOString(), "2033-03-01T03:30:00.000Z"); // 29 feb → 28 feb, misma hora local.
  await run(secondary, future.id, "refund");

  database("UPDATE khypupyme.account_trials SET \"StartedAt\"=now()-interval '31 days', \"EndsAt\"=now()-interval '1 day' WHERE \"FirstBusinessId\"='" + first + "';");
  assert.equal((await read(first)).active, false);
  assert.equal((await read(first)).trialUsed, true);
  await activate(first);
  assert.equal((await read(first)).active, false);
  await command(first, { ...saleInput, operationId: randomUUID() }, 403);
  assert.deepEqual(await command(first, saleInput), sale);
  assert.deepEqual(await commercial(first, "/commands/" + saleInput.operationId), sale);
  assert.equal((await commercial(first, "/documents/" + sale.entityId)).lines[0].productId, product);
  assert.ok((await commercial(first, "/history")).items.some((item) => item.id === sale.entityId));
  const exportData = await commercial(first, "/export");
  assert.equal(exportData.business.id, first);
  assert.ok(exportData.operations.some((item) => item.id === sale.entityId));
  assert.equal(exportData.cashSessions[0].expectedMinor, 15000);
  assert.equal(exportData.payments, undefined);
  await command(first, { kind: "close-cash", amountMinor: 15000, sourceId: opening.entityId });
  await command(first, { kind: "close-cash", amountMinor: 15000, sourceId: opening.entityId }, 409);
  await command(first, { kind: "open-cash", amountMinor: 10000 }, 403);
  console.log("Vencimiento: historial, comprobante, exportación y un cierre de caja disponibles; nuevas operaciones bloqueadas.");

  const firstCookies = new Map(cookies);
  cookies.clear();
  await request(auth + "/register/code", 204, "POST", { email: otherEmail });
  await request(auth + "/register", 204, "POST", { email: otherEmail, code: readCode(otherEmail), password });
  await request(auth + "/login", 204, "POST", { email: otherEmail, password });
  const ownTrial = await create("Negocio para activar prueba");
  assert.equal((await read(ownTrial)).firstBusiness, true);
  await request(businesses + "/" + first + "/plan", 404);
  await begin(first, "1-year", "demo-visa", randomUUID(), 404);
  await commercial(first, "/export", 404);
  if (process.env.KHYPU_TEST_PLAYWRIGHT)
    await (await import("./test-block8-browser.mjs")).checkBrowser(firstCookies, { first, secondary, browserBusiness },
      { cookies, id: ownTrial }, { email, password });
} finally {
  const emails = " IN (upper('" + email + "'), upper('" + otherEmail + "'));";
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"' + emails +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"' + emails;
  database(sql);
}
