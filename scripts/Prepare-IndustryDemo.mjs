import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { activateBusiness } from "./test-billing-fixture.mjs";

const origin = "http://127.0.0.1:5182";
const auth = "/api/v1/auth";
const businessApi = "/api/v1/businesses";
const email = process.env.KHYPU_DEMO_EMAIL;
const password = process.env.KHYPU_DEMO_PASSWORD;
const mailbox = join(process.env.LOCALAPPDATA, "KhypuPyme2.0", "mailbox");
const cookies = new Map();

if (!email || !/^recorridos-[a-z0-9]+@khypupyme\.test$/.test(email) || !password || password.length < 12) {
  throw new Error("Usa una cuenta nueva recorridos-…@khypupyme.test y una contraseña local de al menos doce caracteres.");
}

async function request(path, expected, method = "GET", body) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("X-CSRF-TOKEN", (await request(auth + "/csrf", 200)).token);
    headers.set("Content-Type", "application/json");
  }
  if (cookies.size) headers.set("Cookie", [...cookies].map(([key, value]) => key + "=" + value).join("; "));
  const response = await fetch(origin + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error",
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const equal = pair.indexOf("=");
    cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
  const result = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
  if (response.status !== expected) throw new Error(method + " " + path + " respondió " + response.status + " · " + (result?.detail ?? ""));
  return result;
}

function registrationCode() {
  for (const file of readdirSync(mailbox).filter((name) => name.endsWith(".json"))) {
    const path = join(mailbox, file);
    const message = JSON.parse(readFileSync(path, "utf8"));
    if (message.email !== email || message.purpose !== "registration") continue;
    unlinkSync(path);
    return message.code;
  }
  throw new Error("El buzón local no recibió el código de la cuenta de ejemplo.");
}

const date = (offset) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" }).format(Date.now() + offset * 86_400_000);
const line = (productId, quantity, unitMinor, extra) => ({ productId, quantity, unitMinor, ...extra });
const measured = (productId, quantity, unit, unitMinor, lot, expiresOn) =>
  line(productId, 1, unitMinor, { measure: { quantity: String(quantity), unit, lot, expiresOn } });
const retail = (unit, boxSize, reorder, trackLots = false, rollLength) =>
  ({ retailProduct: { unit, boxSize, reorder, trackLots, rollLength } });

function operations(id) {
  const scope = businessApi + "/" + id + "/commerce";
  const query = (path) => request(scope + path, 200);
  async function send(kind, data) {
    const operationId = randomUUID();
    const result = await request(scope + "/commands", 200, "POST", { operationId, kind, ...data });
    await request(scope + "/commands/" + operationId + "/ack", 204, "POST");
    return result.entityId;
  }
  let productNumber = 0;
  const product = (name, amountMinor, fields) => send("product", { name, code: "DEMO-" + (++productNumber), amountMinor, ...fields });
  const purchase = (...lines) => send("purchase", { method: "transfer", lines });
  const sale = (...lines) => send("sale", { method: "qr", lines });
  const customer = () => send("customer", { name: "Cliente de ejemplo" });
  const work = (customerId, title, fields) => send("save-work", { customerId, work: { title, day: date(0), ...fields } });
  const service = (name, amountMinor) => product(name, amountMinor, { serviceProduct: true });
  async function advance(workId, workState, note) {
    const saved = await query("/work/" + workId);
    return send("advance-work", { workState, workLink: { id: workId, revision: saved.revision }, note });
  }
  return { query, product, purchase, sale, send, customer, work, service, advance };
}

const examples = {
  async grocery({ product, purchase, sale }) {
    const item = await product("Leche entera 1 L", 900, retail("piece", 12, 8, true));
    await purchase(measured(item, 1, "box", 7200, "L-CERCANO", date(4)), measured(item, 1, "box", 7200, "L-VENCIDO", date(-2)));
    await sale(measured(item, 2, "piece", 900));
  },
  async beverages({ product, purchase, send, customer }) {
    const item = await product("Gaseosa retornable", 750, retail("piece", 12, 12));
    await purchase(measured(item, 4, "box", 6000));
    const typeId = await send("container-stock", { name: "Botella retornable", stockQuantity: 48 });
    const customerId = await customer();
    await send("sale", { method: "qr", customerId, lines: [measured(item, 6, "piece", 750)],
      containers: [{ typeId, delivered: 6, returned: 0 }] });
  },
  async cosmetics({ product, purchase }) {
    const item = await product("Labial Rosa 04", 4200, { ...retail("piece", 1, 3, true),
      cosmeticProduct: { brand: "Marca de ejemplo", presentation: "3 g", tone: "Rosa 04", afterOpeningMonths: 12 } });
    await purchase(measured(item, 8, "piece", 2500, "C-01", date(9)));
  },
  async pets({ product, purchase, sale }) {
    const item = await product("Alimento adulto a granel", 1850, retail("kg", 1, 3, true));
    await purchase(measured(item, 15, "kg", 1250, "BOLSA-A", date(40)));
    await sale(measured(item, 1.5, "kg", 1850, "BOLSA-A"));
  },
  async footwear({ product, purchase, sale }) {
    const variant = (size) => ({ apparelProduct: { model: "Andino", size, color: "Negro" } });
    const item = await product("Zapato Andino", 15900, variant("40"));
    await product("Zapato Andino", 15900, variant("41"));
    const other = await product("Zapato Andino", 15900, variant("42"));
    await purchase(line(item, 3, 8200), line(other, 1, 8200));
    await sale(line(item, 1, 15900));
  },
  async electronics({ product, purchase, sale }) {
    const unit = await product("Tableta de demostración", 89000, { equipmentProduct: { warrantyMonths: 12 } });
    const accessory = await product("Cable USB-C", 2500);
    await purchase(line(unit, 2, 52000, { serials: ["DEMO-EL-01", "DEMO-EL-02"] }), line(accessory, 12, 1250));
    await sale(line(unit, 1, 89000, { serials: ["DEMO-EL-01"] }), line(accessory, 1, 2500));
  },
  async hardware({ product, purchase, sale }) {
    const cable = await product("Cable flexible 4 mm²", 725, { ...retail("m", 1, 8, false, 50),
      detailProduct: { reference: "CF-4", measure: "4 mm²", shelf: "A-03" } });
    await purchase(measured(cable, 2, "roll", 24000));
    await sale(measured(cable, 12.5, "m", 725));
  },
  async spareParts({ product, purchase }) {
    const filter = await product("Filtro de aceite", 6500, { detailProduct: { reference: "OEM-001", measure: "Rosca M20", shelf: "B-04" },
      partsProduct: { equivalents: ["EQ-100"], compatibility: [{ brand: "Toyota", model: "Hilux", fromYear: 2010, toYear: 2015, confirmed: true }] } });
    await purchase(line(filter, 5, 3200));
  },
  async stationery({ product, purchase }) {
    const notebook = await product("Cuaderno cuadriculado", 1250);
    await purchase(line(notebook, 20, 650));
    await product("Impresión A4 blanco y negro", 50, { printingProduct: { paperSize: "A4", color: "bw" } });
  },
  async furniture({ product, purchase, sale, send }) {
    const desk = await product("Escritorio 90 cm", 45000, { furnitureProduct: { widthCm: 90, depthCm: 50, heightCm: 75 } });
    await purchase(line(desk, 5, 23500));
    const sourceId = await sale(line(desk, 1, 45000));
    await send("schedule-delivery", { sourceId, delivery: { mode: "pickup", day: date(0) } });
    await send("prepare-delivery", { sourceId });
  },
  async ceramics({ product, purchase }) {
    const tile = await product("Revestimiento Arena", 2150,
      { ...retail("piece", 6, 12), tileProduct: { boxArea: 1.44, tone: "Arena", caliber: "C1" } });
    await purchase(measured(tile, 15, "box", 8400));
  },
  async cement({ product, purchase }) {
    const item = await product("Cemento de demostración 50 kg", 7900,
      { ...retail("piece", 1, 3, true), cementProduct: { bagKg: 50, bulkPriceMinor: 200 } });
    await purchase(measured(item, 12, "piece", 6200, "LOT-50"));
  },
  async beauty({ service, work, customer }) {
    const serviceId = await service("Corte y lavado", 4500);
    const customerId = await customer();
    await work(customerId, "Corte y lavado por la mañana", { serviceId, startMinute: 600, duration: 40 });
    await work(customerId, "Cita de la próxima semana", { day: date(3), serviceId, startMinute: 660, duration: 40 });
  },
  async cleaning({ work, customer }) {
    await work(await customer(), "Limpieza de oficina", { address: "Calle de ejemplo 25", budgetMinor: 18000,
      details: { tasks: "Pisos, vidrios y recepción", plannedMaterials: "Dos paños y un limpiador" } });
  },
  async professional({ work, customer, advance }) {
    const id = await work(await customer(), "Informe de inventario", { day: date(3), budgetMinor: 34000,
      details: { deliverables: "Informe y resumen para presentar" } });
    await advance(id, "approved");
  },
  async repair({ work, customer, advance }) {
    const id = await work(await customer(), "Revisión de teléfono", { budgetMinor: 12000,
      details: { equipment: "Teléfono de ejemplo", accessories: "Funda", fault: "No retiene carga", diagnosis: "Batería degradada" } });
    await advance(id, "diagnosed");
    await advance(id, "approved");
    await advance(id, "working");
    await advance(id, "waiting-parts", "Batería del modelo pendiente");
  },
  async crafts({ work, customer, product, purchase }) {
    const item = await product("Canasta terminada", 6500);
    await purchase(line(item, 3, 3800));
    await work(await customer(), "Canasta personalizada", { day: date(4), budgetMinor: 8500,
      details: { specifications: "Fibras naturales, mango doble y cinta azul" } });
  },
};

await request(auth + "/register/code", 204, "POST", { email });
await request(auth + "/register", 204, "POST", { email, code: registrationCode(), password });
await request(auth + "/login", 204, "POST", { email, password });
const industries = await request(businessApi + "/industries", 200);
for (const [industry, example] of Object.entries(examples)) {
  const id = randomUUID();
  const name = "Demo · " + industries.find((item) => item.id === industry).name;
  await request(businessApi, 200, "POST", { id, industry, name });
  await activateBusiness(request, businessApi + "/" + id);
  await example(operations(id));
  console.log(industry + " preparado");
}
console.log("Ingreso confirmado y " + Object.keys(examples).length + " negocios ficticios preparados.");
