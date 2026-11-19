import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function checkBrowser(cookies, businesses) {
  const { chromium } = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const base = "http://127.0.0.1:5283";
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: base })));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(10_000);
    const button = (name) => page.getByRole("button", { name, exact: typeof name === "string" });
    const dialog = page.getByRole("dialog");
    async function open(id, view = "inicio") {
      const { token } = await (await context.request.get(base + "/api/v1/auth/csrf")).json();
      assert.equal((await context.request.put(base + "/api/v1/businesses/" + id + "/selection",
        { headers: { "X-CSRF-TOKEN": token } })).status(), 204);
      await page.goto(base + "/?vista=" + view);
    }

    const field = (name) => page.getByLabel(name, { exact: true });
    async function chooseClient(industry) {
      await page.locator("summary").filter({ hasText: /^Cliente$/ }).click();
      await button("Cliente " + industry).click();
    }
    async function chooseService(name, appointment = false) {
      await page.locator("summary").filter({ hasText: appointment ? /^Servicio de la cita$/ : /^Servicio a cobrar \(opcional\)$/ }).click();
      await button(name).click();
    }
    async function sellFromCart() {
      await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
      await dialog.getByLabel("Forma de pago").selectOption("qr");
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: "Confirmar venta" }).click();
      await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    }

    await open(businesses.beauty);
    await button("Nueva cita").click();
    await chooseClient("beauty");
    await chooseService(/^Corte clásico · /, true);
    await field("Nombre de la cita").fill("Cita móvil");
    await field("Hora de inicio").fill("11:30");
    await field("Duración (minutos)").fill("45");
    await button("Guardar registro").click();
    await button("Reprogramar cita").click();
    await field("Hora de inicio").fill("11:15");
    await button("Guardar cambios").click();
    await page.getByRole("alert").getByText(/horario se cruza/).waitFor();
    await field("Hora de inicio").fill("12:00");
    await button("Guardar cambios").click();
    await page.getByText(/12:00 – 12:45/).waitFor();
    await button("Marcar atendida").click();
    await button("Cobrar con una venta").click();
    await page.getByRole("heading", { name: "Venta vinculada" }).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByText("Cliente beauty", { exact: true }).waitFor();
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => /^(Carrito|Revisar )/.test(document.activeElement?.textContent?.trim() ?? ""));
    await page.reload();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.equal(await dialog.getByLabel("Forma de pago").inputValue(), "qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await button(/Ver cita u orden · Cita móvil/).click();
    await button("Ver venta vinculada").waitFor();
    assert.equal(await button("Cobrar con una venta").count(), 0);
    await open(businesses.beauty);
    await button("Atender sin cita").click();
    await button(/Corte clásico/).click();
    await sellFromCart();
    await page.getByText("Cliente ocasional", { exact: true }).waitFor();

    await open(businesses.cleaning);
    await button("Nuevo trabajo").click();
    await chooseClient("cleaning");
    await chooseService(/^Limpieza del local · /);
    await field("Nombre del trabajo").fill("Limpieza móvil");
    await field("Dirección del trabajo").fill("Calle de prueba 10");
    await field("Tareas").fill("Limpiar salón");
    await field("Materiales previstos").fill("Dos botellas");
    await button("Guardar registro").click();
    await button("Iniciar trabajo").click();
    await page.getByRole("heading", { name: "En trabajo" }).waitFor();
    await button("Editar orden").click();
    await field("Materiales utilizados").fill("Una botella");
    await button("Guardar cambios").click();
    await page.getByText("Una botella", { exact: true }).waitFor();
    await button("Marcar como listo").click();
    await button("Cobrar con una venta").click();
    await button(/Detergente/).click();
    await sellFromCart();
    await button(/Ver cita u orden · Limpieza móvil/).click();
    await button("Confirmar entrega").click();
    await page.getByRole("heading", { name: "Entregado" }).waitFor();
    await button("Ver venta vinculada").click();
    await page.getByRole("row", { name: /Detergente/ }).waitFor();

    await open(businesses.professional, "trabajos");
    await button("Nuevo trabajo").click();
    await chooseClient("professional");
    await field("Nombre del trabajo").fill("Informe móvil");
    await field("Entregables").fill("Informe y anexos");
    await field("Presupuesto (Bs)").fill("55");
    await button("Guardar registro").click();
    await button("Confirmar aprobación").click();
    await page.getByRole("heading", { name: "Aprobado" }).waitFor();
    await page.getByText("Informe y anexos", { exact: true }).waitFor();
    await page.getByText(/55,00/).waitFor();

    await open(businesses.repair, "trabajos");
    await button("Recibir equipo").click();
    await chooseClient("repair");
    await field("Nombre del trabajo").fill("Taller móvil");
    await field("Equipo recibido").fill("Radio de pruebas");
    await field("Accesorios recibidos").fill("Cable");
    await field("Falla declarada").fill("No enciende");
    await button("Guardar registro").click();
    await button("Emitir constancia de recepción").click();
    await page.getByRole("heading", { name: "Constancia de recepción" }).waitFor();
    await page.getByText(/Equipo: Radio de pruebas/).waitFor();
    const download = page.waitForEvent("download");
    await button("Guardar PDF").click();
    const file = await download;
    assert.match(file.suggestedFilename(), /^REC-.*\.pdf$/);
    assert.equal((await readFile(await file.path())).subarray(0, 5).toString(), "%PDF-");

    await open(businesses.crafts);
    await button("Vender piezas listas").click();
    await button(/Vela lista/).click();
    await sellFromCart();
    await open(businesses.crafts);
    await button("Nuevo encargo").click();
    await chooseClient("crafts");
    await field("Nombre del trabajo").fill("Encargo móvil");
    await field("Especificaciones del encargo").fill("Marco azul");
    await button("Guardar registro").click();
    await page.getByText("Marco azul", { exact: true }).waitFor();

    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: cinco recorridos, cruce en agenda, borrador tras recargar, entrega posterior al cobro y PDF de recepción.");
  } finally {
    await browser.close();
  }
}
