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
const email = "block7d-api-" + randomUUID() + "@example.test";
const password = "Clave de ejemplo de bloque siete D 2026!";
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
  const catalog = await request(businesses + "/industries", 200);
  assert.equal(catalog.length, 21);
  assert.equal(new Set(catalog.map((industry) => industry.id)).size, 21);

  const locations = Object.fromEntries(await Promise.all(Object.entries({
    beauty: "Peluquería QA", cleaning: "Limpieza QA", professional: "Profesionales QA",
    repair: "Taller QA", crafts: "Artesanía QA",
  }).map(async ([id, name]) => [id, await business(id, name)])));
  const users = Object.fromEntries(await Promise.all(Object.entries(locations).map(async ([id, scope]) =>
    [id, (await post(scope, { kind: "customer", name: "Cliente " + id })).entityId])));
  const newService = async (scope, name, code, price) =>
    (await save(scope, name, code, price, { serviceProduct: true })).entityId;
  const read = (scope, id, status = 200) => request(scope + "/work/" + id, status);
  const link = ({ id, revision }) => ({ id, revision });
  const create = async (scope, customerId, work, status = 200) => post(scope, { kind: "save-work", customerId, work: { day: today, ...work } }, status);
  const edit = (scope, row, work, status = 200) => post(scope, { kind: "save-work", customerId: row.customerId,
    work: { title: row.title, day: row.day, startMinute: row.startMinute, duration: row.duration, address: row.address,
      serviceId: row.serviceId, details: row.details, budgetMinor: row.budgetMinor, ...work }, workLink: link(row) }, status);
  async function advance(scope, id, state) {
    const row = await read(scope, id);
    await post(scope, { kind: "advance-work", workState: state, workLink: link(row) });
    const updated = await read(scope, id);
    assert.equal(updated.state, state);
    return updated;
  }
  const charge = (row, lines, fields = {}) => ({ kind: "sale", method: "qr", customerId: row.customerId, workLink: link(row), lines, ...fields });
  const { beauty, cleaning, professional, repair, crafts } = locations;
  const haircut = await newService(beauty, "Corte clásico", "CORT-1", 3500);
  await buy(beauty, [line(haircut, 1, 3500)], 400);
  const appointment = { title: "Corte programado", serviceId: haircut, startMinute: 540, duration: 30 };
  const first = (await create(beauty, users.beauty, appointment)).entityId;
  const adjacent = (await create(beauty, users.beauty, { ...appointment, startMinute: 570, title: "Cita consecutiva" })).entityId;
  await create(beauty, users.beauty, { ...appointment, startMinute: 569 }, 409);
  await create(beauty, users.beauty, { ...appointment, startMinute: 1430 }, 400);
  const competing = await Promise.all([0, 1].map(() => create(beauty, users.beauty,
    { ...appointment, startMinute: 660, title: "Cita simultánea" }, [200, 409])));
  assert.deepEqual(competing.map((value) => value.status).sort(), [200, 409]);
  const original = await read(beauty, first);
  await edit(beauty, original, { startMinute: 565 }, 409);
  await edit(beauty, original, { startMinute: 600, duration: 45 });
  await edit(beauty, original, { startMinute: 640 }, 409);
  const moved = await read(beauty, first);
  assert.equal(moved.duration, 45);
  assert.equal(moved.startMinute, 600);
  await advance(beauty, adjacent, "no-show");
  await create(beauty, users.beauty, { ...appointment, startMinute: 570, title: "Espacio liberado" });
  const day = await request(beauty + "/work?day=" + today, 200);
  assert.ok(day.items.some((item) => item.id === adjacent && item.state === "no-show"));
  assert.ok(day.items.some((item) => item.id === first && item.startMinute === 600));
  await post(beauty, charge(moved, [line(haircut, 1, 3500)]), 409);
  const attended = await advance(beauty, first, "attended");
  await post(beauty, charge(attended, [line(haircut, 1, 3500)], { customerId: undefined }), 400);
  await post(beauty, charge(attended, [line(haircut, 2, 3500)]), 400);
  const sameCharge = charge(attended, [line(haircut, 1, 3500)], { operationId: randomUUID() });
  const salonSale = await post(beauty, sameCharge);
  assert.deepEqual(await post(beauty, sameCharge), salonSale);
  await post(beauty, charge(await read(beauty, first), [line(haircut, 1, 3500)]), 409);
  assert.equal((await document(beauty, salonSale)).work.id, first);
  const scheduled = (await create(beauty, users.beauty, { ...appointment, startMinute: 760, title: "Cita a cancelar" })).entityId;
  const toCancel = await read(beauty, scheduled);
  const cancellation = { operationId: randomUUID(), kind: "advance-work", workState: "cancelled",
    workLink: link(toCancel), note: "La clienta pidió otro día" };
  const scope = beauty.split("/").at(-2);
  await post(beauty, cancellation, 422);
  await request("/api/v1/security/proof", 200, "POST", { id: cancellation.operationId, businessId: scope,
    purpose: "correction", command: cancellation, reason: cancellation.note, password });
  await post(beauty, cancellation);
  assert.equal((await read(beauty, scheduled)).details.statusNote, cancellation.note);
  assert.equal((await request(beauty + "/work?filter=cancelled&search=Cita", 200)).items[0].id, scheduled);
  assert.equal((await request(beauty + "/work?filter=today&search=Cita+a+cancelar", 200)).items.length, 0);
  await create(beauty, users.beauty, { ...appointment, startMinute: 760, title: "Horario recuperado" });
  const walkIn = await sell(beauty, [line(haircut, 1, 3500)]);
  const walkInDoc = await document(beauty, walkIn);
  assert.equal(walkInDoc.work, null);
  assert.equal(walkInDoc.customerName, "Cliente ocasional");
  assert.equal(walkInDoc.lines[0].details.isService, true);
  assert.equal((await product(beauty, haircut)).stock, 0);
  const refund = { kind: "return", method: "qr", note: "Devolución de prueba", sourceId: walkIn.entityId,
    lines: [{ ...line(haircut, 1), originalLineId: walkInDoc.lines[0].lineId, restock: true }] };
  await post(beauty, refund, 400);
  await post(beauty, { ...refund, lines: [{ ...refund.lines[0], restock: false }] });
  assert.equal((await product(beauty, haircut)).valueMinor, 0);
  console.log("Peluquería: cruce y carrera rechazados, horario consecutivo, reprogramación, inasistencia, cobro único y venta ocasional.");

  const labor = await newService(cleaning, "Limpieza del local", "LI-S", 12000);
  const detergent = (await save(cleaning, "Detergente", "LI-P", 2000)).entityId;
  await buy(cleaning, [line(detergent, 5, 1000)]);
  const cleaningWork = { title: "Limpieza oficina", serviceId: labor, address: "Av. Bolivia 100", budgetMinor: 14000,
    details: { tasks: "Limpiar vidrios", plannedMaterials: "Dos botellas" } };
  await create(cleaning, users.cleaning, { ...cleaningWork, address: "" }, 400);
  const job = (await create(cleaning, users.cleaning, cleaningWork)).entityId;
  await read(professional, job, 404);
  await post(professional, { kind: "advance-work", workState: "working", workLink: { id: job, revision: 1 } }, 404);
  const started = await advance(cleaning, job, "working");
  await edit(cleaning, started, { details: { ...started.details, usedMaterials: "Una botella",
    billableMaterials: "Una botella", internalMaterials: "Un paño" } });
  assert.equal((await product(cleaning, detergent)).stock, 5);
  const ready = await advance(cleaning, job, "ready");
  const concurrent = await Promise.all([0, 1].map(() => post(cleaning,
    charge(ready, [line(labor, 1, 12000), line(detergent, 1, 2000)]), [200, 409])));
  const jobBill = concurrent.find((value) => value.status === 200).result;
  assert.deepEqual(concurrent.map((value) => value.status).sort(), [200, 409]);
  const delivered = await advance(cleaning, job, "delivered");
  assert.equal(delivered.saleId, jobBill.entityId);
  assert.equal(delivered.deliveredOn, today);
  assert.equal(delivered.details.usedMaterials, "Una botella");
  assert.equal(delivered.details.billableMaterials, "Una botella");
  assert.equal(delivered.details.internalMaterials, "Un paño");
  assert.equal((await product(cleaning, detergent)).stock, 4);
  assert.equal((await document(cleaning, jobBill)).work.id, job);
  await post(cleaning, charge(delivered, [line(labor, 1, 12000)]), 409);
  console.log("Limpieza: materiales previstos y usados, venta única con existencias y entrega posterior que conserva venta y saldo.");

  const consulting = await newService(professional, "Consultoría", "PRO", 35000);
  const planned = (await create(professional, users.professional,
    { title: "Informe comercial", serviceId: consulting, details: { deliverables: "Informe y presentación" } })).entityId;
  const beforeBudget = await read(professional, planned);
  const receiptRequest = { kind: "work-receipt", workLink: link(beforeBudget), operationId: randomUUID() };
  await post(cleaning, receiptRequest, 404);
  const reportReceipt = await post(professional, receiptRequest);
  assert.equal((await post(professional, receiptRequest)).entityId, reportReceipt.entityId);
  const workDocument = await document(professional, reportReceipt);
  assert.match(workDocument.note, /Entregables: Informe y presentación/);
  await post(professional, { kind: "advance-work", workState: "approved", workLink: link(beforeBudget) }, 409);
  await edit(professional, beforeBudget, { budgetMinor: 35000 });
  await advance(professional, planned, "approved");
  await advance(professional, planned, "working");
  await advance(professional, planned, "ready");
  const project = await advance(professional, planned, "delivered");
  const projectBill = await post(professional, charge(project, [line(consulting, 1, 35000)]));
  assert.equal((await read(professional, planned)).saleId, projectBill.entityId);
  assert.equal(project.budgetMinor, 35000);
  assert.equal(project.details.deliverables, "Informe y presentación");
  console.log("Profesionales: entregables, presupuesto aprobado, compromiso y cobro posterior a la entrega.");

  const fix = await newService(repair, "Mano de obra", "MO", 9000);
  const spare = (await save(repair, "Batería", "BAT", 5000)).entityId;
  await buy(repair, [line(spare, 3, 3000)]);
  const workshop = { title: "Orden de teléfono", serviceId: fix, budgetMinor: 14000,
    details: { equipment: "Teléfono T1", accessories: "Funda", fault: "Se apaga" } };
  const repairId = (await create(repair, users.repair, workshop)).entityId;
  const reception = await read(repair, repairId);
  const received = await post(repair, { kind: "repair-receipt", workLink: link(reception) });
  const receipt = await document(repair, received);
  assert.match(receipt.note, /Equipo: Teléfono T1\nAccesorios recibidos: Funda\nFalla declarada: Se apaga/);
  const withReceipt = await read(repair, repairId);
  assert.deepEqual((await post(repair, { kind: "repair-receipt", workLink: link(withReceipt) })).entityId, receipt.id);
  await post(repair, { kind: "advance-work", workState: "diagnosed", workLink: link(withReceipt) }, 409);
  await edit(repair, withReceipt, { details: { ...withReceipt.details, fault: "Otro texto", diagnosis: "Batería agotada" } });
  await advance(repair, repairId, "diagnosed");
  await advance(repair, repairId, "approved");
  const inProgress = await advance(repair, repairId, "working");
  const waiting = { kind: "advance-work", workState: "waiting-parts", workLink: link(inProgress) };
  await post(repair, waiting, 400);
  await post(repair, { ...waiting, note: "Batería por recibir" });
  const workWait = await read(repair, repairId);
  assert.equal(workWait.details.statusNote, "Batería por recibir");
  assert.equal((await request(repair + "/work?filter=waiting-parts&search=teléfono", 200)).items[0].id, repairId);
  assert.equal((await request(repair + "/work-attention", 200)).waitingParts, 1);
  await post(repair, { kind: "advance-work", workState: "ready", workLink: link(workWait) }, 409);
  assert.equal((await advance(repair, repairId, "working")).details.statusNote ?? null, null);
  const repaired = await advance(repair, repairId, "ready");
  const repairedSale = await post(repair, charge(repaired, [line(fix, 1, 9000), line(spare, 1, 5000)]));
  const returned = await advance(repair, repairId, "delivered");
  assert.equal(returned.saleId, repairedSale.entityId);
  assert.equal(returned.receiptId, receipt.id);
  assert.equal(returned.details.fault, "Se apaga");
  assert.equal((await product(repair, spare)).stock, 2);
  console.log("Taller: constancia inmutable, diagnóstico, presupuesto, reparación, repuesto y entrega con la misma venta.");

  const finished = (await save(crafts, "Vela lista", "VELA", 2500)).entityId;
  const custom = await newService(crafts, "Grabado personalizado", "GRABA", 6500);
  await buy(crafts, [line(finished, 3, 1200)]);
  const retail = await sell(crafts, [line(finished, 1, 2500)]);
  assert.equal((await document(crafts, retail)).work, null);
  const commission = (await create(crafts, users.crafts, { title: "Encargo personalizado", serviceId: custom,
    budgetMinor: 6500, details: { specifications: "Grabado en madera, caja azul" } })).entityId;
  await advance(crafts, commission, "working");
  const finishedWork = await advance(crafts, commission, "ready");
  const finalSale = await post(crafts, charge(finishedWork, [line(custom, 1, 6500)]));
  assert.equal((await advance(crafts, commission, "delivered")).saleId, finalSale.entityId);
  assert.equal((await product(crafts, finished)).stock, 2);
  console.log("Artesanía: venta de una pieza lista separada del encargo y su entrega.");

  if (process.env.KHYPU_TEST_PLAYWRIGHT) await (await import("./test-block7d-browser.mjs")).checkBrowser(cookies,
    Object.fromEntries(Object.entries(locations).map(([key, path]) => [key, path.split("/").at(-2)])));
} finally {
  const sql = 'DELETE FROM khypupyme."AspNetUsers" WHERE "NormalizedEmail"=upper(\'' + email + '\'); ' +
    'DELETE FROM khypupyme.email_challenges WHERE "Email"=upper(\'' + email + '\');';
  execFileSync(process.env.KHYPU_TEST_PSQL,
    ["-X", "-w", "-h", "127.0.0.1", "-p", "5432", "-U", "khypupyme2_test_owner", "-d", "khypupyme2_test", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: owner }, stdio: ["ignore", "ignore", "pipe"] });
}
