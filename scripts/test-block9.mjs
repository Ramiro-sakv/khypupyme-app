import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const base = "http://127.0.0.1:5183";
const mailbox = process.env.Email__MailboxPath;
const { owner, app } = JSON.parse(readFileSync(0, "utf8"));
const email = "block9-api-" + randomUUID() + "@example.test";
const otherEmail = "block9-other-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque nueve 2026!";
const cookies = new Map();

async function request(path, expected, method = "GET", body) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", (await request(auth + "/csrf", 200)).token);
    headers.set("Content-Type", "application/json");
  }
  if (cookies.size) headers.set("Cookie", [...cookies].map(([key, value]) => key + "=" + value).join("; "));
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

const security = "/api/v1/security";
function codeFor(emailAddress, purpose) {
  for (const item of readdirSync(mailbox).filter((file) => file.endsWith(".json"))) {
    const path = join(mailbox, item);
    const message = JSON.parse(readFileSync(path, "utf8"));
    if (message.email === emailAddress && message.purpose === purpose) { unlinkSync(path); return message.code; }
  }
  throw Error("No llegó el código al buzón de prueba.");
}
function psql(sql, runtime = false) {
  return execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_" + (runtime ? "app" : "owner"),
      "-d", "khypupyme2_test", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: runtime ? app : owner }, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}
const post = (path, body, status = 200) => request(path, status, "POST", body);
async function register(address) {
  await post(auth + "/register/code", { email: address }, 204);
  await post(auth + "/register", { email: address, password, code: codeFor(address, "registration") }, 204);
  await post(auth + "/login", { email: address, password }, 204);
  return (await request(auth + "/session", 200)).accountId;
}
async function business(name, industry = "grocery") {
  const id = randomUUID();
  await post(businesses, { id, name, industry, ...(industry === "timber" ? { timberUnits: "imperial" } : {}) });
  return id;
}
const commerce = (id) => businesses + "/" + id + "/commerce";
const ack = (id, operation, status = 204) => post(commerce(id) + "/commands/" + operation + "/ack", undefined, status);
const command = async (biz, body, status = 200, settle = true) => {
  const input = { operationId: randomUUID(), ...body };
  const receipt = await post(commerce(biz) + "/commands", input, status);
  if (settle && status === 200) await ack(biz, input.operationId);
  return receipt;
};
const proof = (biz, body, status = 200, reason = "Corrección comprobada") => post(security + "/proof",
  { id: body.operationId, purpose: "correction", businessId: biz, command: body, reason, password }, status);
const protectedCommand = async (biz, body) => {
  const input = { operationId: randomUUID(), ...body };
  await proof(biz, input);
  return command(biz, input);
};
const deletion = (biz, action = "") => security + "/businesses/" + biz + (action ? "/" + action : "");
const deletionProof = (biz, name, id, status = 200) => post(security + "/proof",
  { id, purpose: "delete-business", businessId: biz, name, password }, status);
const runAs = (actor, biz) => "BEGIN; SELECT set_config('app.account_id','" + actor + "',true),set_config('app.business_id','" + biz + "',true); ";
const fixtureName = "Sicomoro de seguridad";

async function nativeSession() {
  const verifier = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const client = "khypupyme-windows";
  const redirect = "http://127.0.0.1:43823/callback";
  const params = new URLSearchParams({ client_id: client, response_type: "code", redirect_uri: redirect,
    code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    scope: "khypupyme_api offline_access" });
  const cookie = [...cookies].map(([key, value]) => key + "=" + value).join("; ");
  const authorize = await fetch(base + "/connect/authorize?" + params, { redirect: "manual", headers: { Cookie: cookie } });
  assert.equal(authorize.status, 302);
  const code = new URL(authorize.headers.get("location")).searchParams.get("code");
  assert.ok(code);
  const token = await fetch(base + "/connect/token", { method: "POST", body: new URLSearchParams({
    client_id: client, grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect }) });
  assert.equal(token.status, 200);
  return token.json();
}

try {
  const actor = await register(email);
  const first = await business(fixtureName, "timber");
  await post(businesses + "/" + first + "/plan/trial", undefined, 204);
  const sibling = await business("Negocio protegido");
  const payment = await post(businesses + "/" + sibling + "/plan/attempts", { id: randomUUID(), planId: "30-days", cardId: "demo-visa" });
  await post(businesses + "/" + sibling + "/plan/attempts/" + payment.id, { action: "confirm" });
  const product = (await command(first, { kind: "product", name: "Tabla", code: "T", amountMinor: 2500 })).entityId;
  const opening = await command(first, { kind: "open-cash", amountMinor: 10000 });
  await command(first, { kind: "purchase", method: "transfer", lines: [{ productId: product, quantity: 4, unitMinor: 1000 }] });
  const sale = await command(first, { kind: "sale", method: "cash", lines: [{ productId: product, quantity: 2, unitMinor: 2500 }] });
  const saleDoc = await request(commerce(first) + "/documents/" + sale.entityId, 200);

  const price = { operationId: randomUUID(), kind: "product", entityId: product, name: "Tabla corregida", code: "T", amountMinor: 3000 };
  await command(first, price, 422);
  await proof(first, price, 400, "");
  await proof(first, price);
  await command(first, { ...price, amountMinor: 4500 }, 422);
  await command(sibling, price, 422);
  await command(first, price);
  await command(first, price); // Recuperación del mismo resultado, sin una segunda auditoría.
  await proof(first, price, 409);
  const customer = (await command(first, { kind: "customer", name: "Cliente anterior" })).entityId;
  const edit = { operationId: randomUUID(), kind: "customer", entityId: customer, name: "Cliente corregido" };
  await proof(first, edit);
  psql("UPDATE khypupyme.security_proofs SET \"ExpiresAt\"=now()-interval '1 second' WHERE \"Id\"='" + edit.operationId + "';");
  await command(first, edit, 422);
  await protectedCommand(first, { ...edit, operationId: randomUUID() });
  const refund = { kind: "return", sourceId: sale.entityId, method: "cash", note: "Devolución parcial",
    lines: [{ productId: product, originalLineId: saleDoc.lines[0].lineId, quantity: 1, restock: true }] };
  await command(first, refund, 422);
  await protectedCommand(first, refund);
  const expense = await command(first, { kind: "expense", method: "cash", amountMinor: 500, note: "Gasto de prueba" });
  await protectedCommand(first, { kind: "void-expense", sourceId: expense.entityId, note: "Asiento duplicado" });
  await protectedCommand(first, { kind: "stock-loss", note: "Pieza dañada", lines: [{ productId: product, quantity: 1 }] });
  const cash = await request(commerce(first) + "/cash", 200);
  const close = { kind: "close-cash", sourceId: opening.entityId, amountMinor: cash.session.expectedMinor - 100, note: "Conteo físico" };
  await command(first, close, 422);

  const requestId = randomUUID();
  await deletionProof(first, "sicOmoro de seguridad", requestId, 400);
  await deletionProof(first, fixtureName, requestId);
  await post(deletion(first, "code"), { id: requestId, name: fixtureName }, 409);
  await protectedCommand(first, close);
  const unresolved = await command(first, { kind: "customer", name: "Resultado sin revisar" }, 200, false);
  assert.equal((await request(commerce(first) + "/unconfirmed", 200)).length, 1);
  await post(deletion(first, "code"), { id: requestId, name: fixtureName }, 409);
  await ack(sibling, unresolved.operationId, 404);
  assert.deepEqual(await request(commerce(first) + "/commands/" + unresolved.operationId, 200), unresolved);
  await ack(first, unresolved.operationId);

  const audit = (await request(commerce(first) + "/audit", 200)).items;
  assert.equal(audit.length, 6);
  const priceAudit = audit.find((item) => item.operationId === price.operationId);
  assert.equal(priceAudit.accountId, actor);
  assert.equal(JSON.parse(priceAudit.effect).Previous.PriceMinor, 2500);
  assert.equal(JSON.parse(priceAudit.effect).Command.AmountMinor, 3000);
  const exported = await request(commerce(first) + "/export", 200);
  assert.equal(exported.business.id, first);
  assert.equal(exported.audit.length, audit.length);
  assert.ok(exported.operations.some((row) => row.id === sale.entityId));
  assert.equal(exported.securityProofs, undefined);
  assert.throws(() => psql(runAs(actor, first) + 'UPDATE khypupyme.commerce_audit SET "Reason"=\'alterado\'; ROLLBACK;', true),
    (error) => error.stderr.toString().includes("commerce_audit"));
  assert.throws(() => psql(runAs(actor, first) + 'DELETE FROM khypupyme.commerce_audit; ROLLBACK;', true),
    (error) => error.stderr.toString().includes("commerce_audit"));
  assert.equal(psql(runAs(actor, sibling) + "SELECT count(*) FROM khypupyme.commerce_audit; ROLLBACK;", true).split(/\r?\n/).at(-1), "0");
  console.log("Correcciones: autorización por contenido, motivo y titular, caducidad, consumo único y auditoría inmutable con el rol de ejecución.");

  const profile = (biz) => request(businesses + "/" + biz, 200);
  const initial = { revision: 0, defaultPayment: "cash", maxDiscountPercent: 100, quoteDays: 7, allowNewCredit: true, lotAlertDays: 30 };
  assert.deepEqual((await profile(sibling)).policy, initial);
  const shopProduct = (await command(sibling, { kind: "product", name: "Conserva", code: "CONS", amountMinor: 1000,
    retailProduct: { unit: "piece", boxSize: 1, reorder: 1, trackLots: true } })).entityId;
  const shopCustomer = (await command(sibling, { kind: "customer", name: "Cliente de almacén" })).entityId;
  const expiry = (days) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" })
    .format(Date.now() + days * 86_400_000);
  const items = (quantity = "1", lot, expiresOn) =>
    [{ productId: shopProduct, quantity: 1, unitMinor: 1000, measure: { quantity, unit: "piece", lot, expiresOn } }];
  await command(sibling, { kind: "purchase", method: "qr", lines: items("8", "AL-15", expiry(15)) });
  const oldQuote = await command(sibling, { kind: "quote", discountMinor: 500, lines: items() });
  const previousDebt = await command(sibling, { kind: "manual-debt", customerId: shopCustomer, amountMinor: 1000, note: "Fiado previo" });
  assert.equal((await request(commerce(sibling) + "/attention", 200)).expiring, 1);

  const changePolicy = { operationId: randomUUID(), kind: "configure-business", policy: {
    ...initial, defaultPayment: "qr", maxDiscountPercent: 10, quoteDays: 12, allowNewCredit: false, lotAlertDays: 5,
  } };
  await command(sibling, changePolicy, 422);
  await proof(sibling, changePolicy);
  await command(sibling, { ...changePolicy, policy: { ...changePolicy.policy, quoteDays: 13 } }, 422);
  await command(first, changePolicy, 422);
  const configured = await command(sibling, changePolicy);
  assert.deepEqual(await command(sibling, changePolicy), configured);
  assert.deepEqual((await profile(first)).policy, initial);
  assert.deepEqual((await profile(sibling)).policy, { ...changePolicy.policy, revision: 1 });
  const auditPolicy = (await request(commerce(sibling) + "/audit", 200)).items;
  assert.equal(auditPolicy.length, 1);
  assert.equal(auditPolicy[0].kind, "configure-business");
  assert.equal(JSON.parse(auditPolicy[0].effect).Previous.MaxDiscountPercent, 100);
  assert.equal(JSON.parse(auditPolicy[0].effect).Command.Policy.MaxDiscountPercent, 10);
  const stalePolicy = { ...changePolicy, operationId: randomUUID(), policy: { ...changePolicy.policy, defaultPayment: "transfer" } };
  await proof(sibling, stalePolicy);
  await command(sibling, stalePolicy, 409);
  const invalidPolicy = { ...stalePolicy, operationId: randomUUID(), policy: { ...stalePolicy.policy, revision: 1, quoteDays: 91 } };
  await proof(sibling, invalidPolicy);
  await command(sibling, invalidPolicy, 400);

  assert.equal((await request(commerce(sibling) + "/attention", 200)).expiring, 0);
  assert.equal((await request(commerce(sibling) + "/warehouse?attention=expiring", 200)).items.length, 0);
  await command(sibling, { kind: "purchase", method: "qr", lines: items("1", "AL-3", expiry(3)) });
  assert.equal((await request(commerce(sibling) + "/attention", 200)).expiring, 1);
  assert.equal((await request(commerce(sibling) + "/products?attention=expiring", 200)).items[0].id, shopProduct);
  await command(sibling, { kind: "manual-debt", customerId: shopCustomer, amountMinor: 100, note: "Fiado nuevo" }, 400);
  await command(sibling, { kind: "sale", method: "credit", customerId: shopCustomer, lines: items() }, 400);
  await command(sibling, { kind: "collect", sourceId: previousDebt.entityId, method: "qr", amountMinor: 1000 });
  await command(sibling, { kind: "sale", discountMinor: 101, method: "qr", lines: items() }, 400);
  await command(sibling, { kind: "quote", discountMinor: 101, lines: items() }, 400);
  await command(sibling, { kind: "sale", sourceId: oldQuote.entityId, discountMinor: 500, method: "qr", lines: items() });
  const newQuote = await command(sibling, { kind: "quote", discountMinor: 100, lines: items() });
  const policyQuote = await request(commerce(sibling) + "/documents/" + newQuote.entityId, 200);
  assert.equal((Date.parse(policyQuote.expiresOn) - Date.parse(policyQuote.date)) / 86_400_000, 12);
  assert.equal((await request(commerce(sibling) + "/export", 200)).business.policy.allowNewCredit, false);
  console.log("Reglas de negocio: confirmación y auditoría, revisión obsoleta rechazada, cotización histórica, fiados y aviso de lotes en PostgreSQL.");

  const practice = (await post(businesses + "/" + first + "/practice", { action: "start" })).session.sandboxId;
  await post(deletion(first, "code"), { id: requestId, name: fixtureName }, 204);
  const expired = codeFor(email, "delete-business");
  psql("UPDATE khypupyme.security_proofs SET \"ExpiresAt\"=now()-interval '1 second' WHERE \"Id\"='" + requestId + "'; " +
    "UPDATE khypupyme.security_mail_limits SET \"SentAt\"=ARRAY[now()-interval '2 minutes'] WHERE \"OwnerId\"='" + actor + "';");
  await post(deletion(first, "confirm"), { id: requestId, name: fixtureName, code: expired }, 400);
  const next = randomUUID();
  await deletionProof(first, fixtureName, next);
  await post(deletion(first, "code"), { id: next, name: fixtureName }, 204);
  const valid = codeFor(email, "delete-business");
  await post(deletion(first, "confirm"), { id: next, name: fixtureName, code: valid === "11111" ? "22222" : "11111" }, 400);
  const queued = await post(deletion(first, "confirm"), { id: next, name: fixtureName, code: valid });
  assert.equal(queued.state, "pending");
  assert.equal(queued.sandboxId, practice);
  await post(deletion(first, "confirm"), { id: next, name: fixtureName, code: valid }, 409);
  await request(businesses + "/" + first, 404);
  await request(commerce(first) + "/export", 404);
  await request(businesses + "/" + practice + "/practice-commerce/history", 404);
  await command(first, { kind: "customer", name: "No debe registrarse" }, 409);

  const actorCookies = new Map(cookies);
  cookies.clear();
  const other = await register(otherEmail);
  const foreign = await business("Cuenta separada");
  await post(businesses + "/" + foreign + "/plan/trial", undefined, 204);
  const browserProduct = await command(foreign, { kind: "product", name: "Producto del navegador", code: "PR-1", amountMinor: 2000 });
  const otherCookies = new Map(cookies);
  await request(businesses + "/" + sibling, 404);
  await command(sibling, { ...changePolicy, operationId: randomUUID() }, 404);
  await request(deletion(first), 404);
  await post(deletion(first, "resume"), undefined, 404);
  assert.equal(psql(runAs(other, foreign) + "SELECT count(*) FROM khypupyme.business_deletions; ROLLBACK;", true).split(/\r?\n/).at(-1), "0");
  cookies.clear();
  for (const [key, value] of actorCookies) cookies.set(key, value);

  const untouched = psql(runAs(actor, sibling) + "SELECT set_config('app.delete_business','" + first +
    "',true); WITH gone AS (DELETE FROM khypupyme.businesses WHERE \"Id\"='" + sibling + "' RETURNING 1) SELECT count(*) FROM gone; ROLLBACK;", true);
  assert.equal(untouched.split(/\r?\n/).at(-1), "0");
  assert.ok((await request(security + "/businesses", 200)).some((item) => item.businessId === first));
  assert.equal((await post(deletion(first, "resume"))).state, "completed");
  assert.equal((await post(deletion(first, "resume"))).state, "completed");
  const survivors = await request(businesses, 200);
  assert.deepEqual(survivors.items.map((item) => item.id), [sibling]);
  await post(businesses + "/" + sibling + "/plan/trial", undefined, 409); // La prueba de cuenta se conserva.
  assert.equal(psql("SELECT count(*) FROM khypupyme.businesses WHERE \"Id\" IN ('" + first + "','" + practice + "');"), "0");
  assert.equal(psql("SELECT count(*) FROM khypupyme.commerce_audit WHERE \"BusinessId\"='" + first + "';"), "0");
  console.log("Borrado: caja y resultado incierto bloquearon el proceso; código vencido, incorrecto y reutilizado rechazados; reanudación y aislamiento comprobados.");

  const savedCustomer = await command(sibling, { kind: "customer", name: "Cliente que permanece" });
  await protectedCommand(sibling, { kind: "customer", name: "Cliente restaurable", entityId: savedCustomer.entityId });

  const revokeId = randomUUID();
  const native = await nativeSession();
  const bearer = { Authorization: "Bearer " + native.access_token };
  assert.ok(native.refresh_token);
  assert.equal((await fetch(base + businesses, { headers: bearer })).status, 200);
  await post(security + "/proof", { id: revokeId, purpose: "revoke-sessions", password });
  await post(security + "/account/revoke", { id: revokeId }, 204);
  cookies.clear();
  for (const [key, value] of actorCookies) cookies.set(key, value);
  await request(businesses, 401);
  assert.equal((await fetch(base + businesses, { headers: bearer })).status, 401);
  const refresh = await fetch(base + "/connect/token", { method: "POST", body: new URLSearchParams({
    client_id: "khypupyme-windows", grant_type: "refresh_token", refresh_token: native.refresh_token }) });
  assert.equal(refresh.status, 400);
  await post(auth + "/login", { email, password }, 204);
  const closingId = randomUUID();
  await post(security + "/proof", { id: closingId, purpose: "delete-account", password });
  await post(security + "/account/request-deletion", { id: closingId }, 204);
  await post(auth + "/login", { email, password }, 429);
  assert.equal(psql("SELECT count(*) FROM khypupyme.account_closures WHERE \"OwnerId\"='" + actor + "';"), "1");
  assert.equal(psql("SELECT count(*) FROM khypupyme.businesses WHERE \"Id\"='" + sibling + "';"), "1");
  console.log("Cuenta: revocación de sesiones web e instaladas y solicitud de baja persistente; acceso suspendido e historial conservado.");

  if (process.env.KHYPU_TEST_PLAYWRIGHT)
    await (await import("./test-block9-browser.mjs")).checkBrowser(otherCookies, foreign, browserProduct.entityId,
      () => codeFor(otherEmail, "delete-business"));

  cookies.clear();
  for (const [key, value] of otherCookies) cookies.set(key, value);
  psql("UPDATE khypupyme.\"AspNetUsers\" SET \"PasswordHash\"=NULL WHERE \"Id\"='" + other + "'; " +
    "UPDATE khypupyme.security_mail_limits SET \"SentAt\"=ARRAY[now()-interval '2 minutes'] WHERE \"OwnerId\"='" + other + "';");
  assert.deepEqual(await request(security + "/methods", 200), { password: false, email: true });
  const byEmail = { id: randomUUID(), purpose: "revoke-sessions" };
  assert.equal((await post(security + "/proof", { ...byEmail, sendCode: true })).stage, "identity-mail");
  assert.equal((await post(security + "/proof", { ...byEmail, code: codeFor(otherEmail, "security-identity") })).stage, "approved");
  console.log("La confirmación por correo funcionó para una cuenta de prueba sin contraseña.");

  if (process.env.KHYPU_TEST_DUMP_PATH) execFileSync(process.env.KHYPU_TEST_PGDUMP,
    ["-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "--no-owner",
      "--no-acl", "-Fc", "-f", process.env.KHYPU_TEST_DUMP_PATH],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "pipe", "pipe"] });
} finally {
  const addresses = " IN (upper('" + email + "'), upper('" + otherEmail + "'));";
  const accounts = ' IN (SELECT "Id"::text FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"' + addresses.slice(0, -1) + ');';
  psql('DELETE FROM khypupyme."OpenIddictTokens" WHERE "Subject"' + accounts +
    'DELETE FROM khypupyme."OpenIddictAuthorizations" WHERE "Subject"' + accounts +
    'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"' + addresses +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"' + addresses);
}
