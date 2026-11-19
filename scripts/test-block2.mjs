import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const auth = "/api/v1/auth";
const businesses = "/api/v1/businesses";
const tag = "block2-" + randomUUID();
const mailbox = process.env.Email__MailboxPath;
const secrets = JSON.parse(readFileSync(0, "utf8"));
const password = "Password de ejemplo local 001!";
const replacement = "Password de ejemplo local 002!";
const aEmail = tag + "-a@example.test";
const bEmail = tag + "-b@example.test";
const otpEmail = tag + "-otp@example.test";

function sql(statement, access = "owner") {
  return execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_" + access,
      "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-Atc", statement],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: secrets[access] } }).trim().split(/\r?\n/);
}

class Client {
  #cookies = new Map();

  async request(path, expected, { method = "GET", body, bearer, noCsrf = false } = {}) {
    const headers = new Headers();
    if (bearer) headers.set("Authorization", "Bearer " + bearer);
    if (method !== "GET" && !bearer && !noCsrf) {
      headers.set("X-CSRF-TOKEN", (await this.request(auth + "/csrf", 200)).body.token);
    }
    if (this.#cookies.size) headers.set("Cookie", [...this.#cookies.entries()].map(([key, value]) => key + "=" + value).join("; "));
    if (body && !(body instanceof URLSearchParams)) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }
    const response = await fetch("http://127.0.0.1:5183" + path, {
      method, headers, body, redirect: "manual", signal: AbortSignal.timeout(6000),
    });
    for (const header of response.headers.getSetCookie()) {
      const cookie = header.split(";")[0];
      const split = cookie.indexOf("=");
      this.#cookies.set(cookie.slice(0, split), cookie.slice(split + 1));
    }
    assert.equal(response.status, expected, method + " " + path.split("?")[0]);
    return {
      body: response.headers.get("content-type")?.includes("json") ? await response.json() : null,
      location: response.headers.get("location"),
    };
  }

  post(path, expected, body) { return this.request(path, expected, { method: "POST", body }); }
  put(path, expected, body) { return this.request(path, expected, { method: "PUT", body }); }
  oauth(path, expected, body) {
    return this.request(path, expected, { method: "POST", noCsrf: true, body: new URLSearchParams(body) });
  }
}

function readCode(email, purpose) {
  for (const name of readdirSync(mailbox).filter((file) => file.endsWith(".json"))) {
    const path = join(mailbox, name);
    const message = JSON.parse(readFileSync(path, "utf8"));
    if (message.email !== email || message.purpose !== purpose) continue;
    unlinkSync(path);
    assert.match(message.code, /^[0-9]{5}$/);
    return message.code;
  }
  throw Error("No llegó el código al buzón de pruebas.");
}

async function register(client, email) {
  await client.post(auth + "/register/code", 204, { email });
  const payload = { email, code: readCode(email, "registration"), password };
  await client.post(auth + "/register", 204, payload);
  await client.post(auth + "/register", 400, payload);
  await client.post(auth + "/login", 204, { email, password });
}

async function create(client, name, industry) {
  const id = randomUUID();
  const body = { id, name, industry, city: "La Paz", timberUnits: industry === "timber" ? "imperial" : null };
  assert.equal((await client.post(businesses, 200, body)).body.id, id);
  await client.post(businesses, 200, body);
  await client.post(businesses, 409, { ...body, name: name + " duplicado" });
  return id;
}

const a = new Client();
const b = new Client();
const anon = new Client();

try {
  for (let attempt = 0; ; attempt++) {
    try { await anon.request("/api/v1/health/database", 200); break; }
    catch (error) { if (attempt >= 25) throw error; await delay(200); }
  }

  await anon.request(businesses, 401);
  await anon.request(auth + "/google/start", 503);
  await a.request(auth + "/register/code", 400, { method: "POST", noCsrf: true, body: { email: aEmail } });
  await register(a, aEmail);
  await register(b, bEmail);

  await anon.post(auth + "/register/code", 204, { email: otpEmail });
  const first = readCode(otpEmail, "registration");
  await anon.post(auth + "/register/code", 429, { email: otpEmail });
  const where = ' WHERE "Email" = upper(\'' + otpEmail + '\')';
  sql('UPDATE khypupyme.email_challenges SET "ExpiresAt" = now() - interval \'1 second\', "SentAt" = ARRAY[now() - interval \'2 minutes\']' + where);
  const invalid = { email: otpEmail, code: first, password };
  await anon.post(auth + "/register", 400, invalid);
  await anon.post(auth + "/register/code", 204, { email: otpEmail });
  const second = readCode(otpEmail, "registration");
  assert.notEqual(first, second);
  for (let n = 1; n <= 5; n++) await anon.post(auth + "/register", n === 5 ? 429 : 400, invalid);
  await anon.post(auth + "/register", 429, { ...invalid, code: second });
  sql('UPDATE khypupyme.email_challenges SET "SentAt" = ARRAY[now() - interval \'2 minutes\',now() - interval \'3 minutes\']' + where);
  await anon.post(auth + "/register/code", 204, { email: otpEmail });
  readCode(otpEmail, "registration");
  sql('UPDATE khypupyme.email_challenges SET "SentAt" = ARRAY[now() - interval \'2 minutes\',now() - interval \'3 minutes\',now() - interval \'4 minutes\']' + where);
  await anon.post(auth + "/register/code", 429, { email: otpEmail });
  console.log("Registro, CSRF, código reutilizado/vencido, reenvío y límites comprobados.");

  const a1 = await create(a, "Sicomoro prueba", "timber");
  const a2 = await create(a, "Tienda prueba", "convenience");
  const b1 = await create(b, "Moda prueba", "clothing");
  const b2 = await create(b, "Equipos prueba", "appliances");
  assert.equal((await a.request(businesses + "/industries", 200)).body.length, 21);
  for (const [client, ids, foreign] of [[a, [a1, a2], b1], [b, [b1, b2], a1]]) {
    const results = (await client.request(businesses, 200)).body.items.map(({ id }) => id);
    assert.deepEqual(results.toSorted(), ids.toSorted());
    const path = businesses + "/" + foreign;
    await client.request(path, 404);
    await client.put(path + "/selection", 404);
    await client.put(path + "/settings", 404, { businessId: foreign });
  }

  assert.equal((await a.request(businesses + "?search=sicomoro", 200)).body.items[0].id, a1);
  assert.equal((await a.request(businesses + "?page=2", 200)).body.items.length, 0);
  await a.request(businesses + "?page=0", 400);
  assert.equal((await a.request(businesses + "/last", 200)).body.business.id, a2);
  await a.put(businesses + "/" + a1 + "/selection", 204);
  await a.put(businesses + "/" + a1 + "/settings", 400, { businessId: a2 });
  await a.put(businesses + "/" + a1 + "/settings", 204, { businessId: a1, city: "El Alto", timberUnits: "metric" });
  const profile = (await a.request(businesses + "/" + a1, 200)).body;
  assert.deepEqual([profile.city, profile.timberUnits, profile.industry], ["El Alto", "metric", "timber"]);
  assert.equal((await a.request(businesses + "/last", 200)).body.business.id, a1);

  const [owner] = sql('SELECT "Id" FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail" = upper(\'' + aEmail + '\')');
  assert.match(owner, /^[a-f0-9-]{36}$/);
  const setAccount = "SELECT set_config('app.account_id','" + owner + "',true);";
  const setBusiness = "SELECT set_config('app.business_id','" + a1 + "',true);";
  assert.equal(sql("SELECT count(*) FROM khypupyme.businesses", "app")[0], "0");
  assert.equal(sql("SELECT has_column_privilege(current_user, 'khypupyme.businesses', 'Industry', 'UPDATE')", "app")[0], "f");
  assert.equal(sql("BEGIN;" + setAccount + setBusiness + "SELECT count(*) FROM khypupyme.business_settings; ROLLBACK;", "app").at(-2), "1");
  sql("BEGIN;" + setAccount + 'DO $$ BEGIN BEGIN UPDATE khypupyme.account_selections SET "BusinessId"=\'' +
    b1 + '\'; RAISE EXCEPTION \'La referencia cruzada fue aceptada\'; EXCEPTION WHEN foreign_key_violation THEN NULL; END; END $$; ROLLBACK;', "app");
  console.log("Dos cuentas, cuatro negocios, búsqueda, selección, escrituras cruzadas, RLS y claves foráneas comprobados.");

  const verifier = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirect = "http://127.0.0.1:43823/callback";
  const authorize = new URLSearchParams({ client_id: "khypupyme2-windows", response_type: "code", redirect_uri: redirect,
    scope: "khypupyme_api offline_access", state: "block-two" });
  const missing = await a.request("/connect/authorize?" + authorize, 400);
  assert.equal(missing.location, null);
  authorize.set("code_challenge_method", "S256");
  authorize.set("code_challenge", challenge);
  const unauthenticated = await anon.request("/connect/authorize?" + authorize, 302);
  assert.match(unauthenticated.location, /^\/\?returnTo=/);
  authorize.set("prompt", "login");
  const renewal = await a.request("/connect/authorize?" + authorize, 302);
  assert.match(renewal.location, /^\/\?returnTo=/);
  assert.ok(!new URL(renewal.location, "http://127.0.0.1:5183").searchParams.get("returnTo").includes("prompt="));
  await a.request(businesses, 401);
  await a.post(auth + "/login", 204, { email: aEmail, password });
  authorize.delete("prompt");
  const grant = await a.request("/connect/authorize?" + authorize, 302);
  const grantResult = new URL(grant.location).searchParams;
  assert.equal(grantResult.get("state"), "block-two");
  assert.ok(grantResult.get("code"));
  const requestTicket = { grant_type: "authorization_code", client_id: "khypupyme2-windows",
    redirect_uri: redirect, code: grantResult.get("code"), code_verifier: verifier };
  const ticket = (await anon.oauth("/connect/token", 200, requestTicket)).body;
  assert.ok(ticket.refresh_token);
  assert.equal((await anon.request(auth + "/native-session", 200, { bearer: ticket.access_token })).body.email, aEmail);
  await anon.request(auth + "/native-session", 401);
  await anon.request(businesses + "/" + b1, 404, { bearer: ticket.access_token });
  assert.equal((await anon.request(businesses, 200, { bearer: ticket.access_token })).body.items.length, 2);
  await anon.request(businesses + "/" + a1 + "/settings", 204, {
    method: "PUT", bearer: ticket.access_token, body: { businessId: a1, city: "El Alto", timberUnits: "metric" },
  });
  const android = new URLSearchParams(authorize);
  android.set("client_id", "khypupyme2-android");
  android.set("redirect_uri", "bo.khypupyme.piloto:/oauth/callback");
  const androidGrant = await a.request("/connect/authorize?" + android, 302);
  assert.match(androidGrant.location, /^bo\.khypupyme\.piloto:\/oauth\/callback\?/);
  const requestAndroid = { grant_type: "authorization_code", client_id: "khypupyme2-android",
    redirect_uri: android.get("redirect_uri"), code: new URL(androidGrant.location).searchParams.get("code"), code_verifier: verifier };
  await anon.oauth("/connect/token", 400, { ...requestAndroid, code_verifier: verifier + "wrong" });
  await anon.oauth("/connect/token", 200, requestAndroid);
  await anon.oauth("/connect/token", 400, requestAndroid);
  console.log("Autorización instalada, retorno para Windows y Android y uso del token comprobados.");

  await anon.post(auth + "/recover/code", 204, { email: aEmail });
  const recovery = { email: aEmail, password: replacement, code: readCode(aEmail, "recovery") };
  await anon.post(auth + "/recover", 204, recovery);
  await anon.post(auth + "/recover", 400, recovery);
  await a.request(businesses, 401);
  await anon.request(businesses, 401, { bearer: ticket.access_token });
  await anon.oauth("/connect/token", 400, { grant_type: "refresh_token", client_id: "khypupyme2-windows", refresh_token: ticket.refresh_token });
  await a.post(auth + "/login", 401, { email: aEmail, password });
  await a.post(auth + "/login", 204, { email: aEmail, password: replacement });
  await a.post(auth + "/logout", 204);
  await a.request(businesses, 401);
  console.log("Recuperación, revocación de sesiones y cierre de sesión comprobados.");
} finally {
  const pattern = "upper('" + tag + "-%@example.test')";
  const subjects = ' (SELECT "Id"::text FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail" LIKE ' + pattern + ')';
  sql('DELETE FROM khypupyme."OpenIddictTokens" WHERE "Subject" IN' + subjects +
    '; DELETE FROM khypupyme."OpenIddictAuthorizations" WHERE "Subject" IN' + subjects +
    '; DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail" LIKE ' + pattern +
    '; DELETE FROM khypupyme.email_challenges WHERE "Email" LIKE ' + pattern);
}
