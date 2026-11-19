import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function checkBrowser(cookies, businesses, password) {
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

    await open(businesses.furniture, "cotizaciones");
    await button(/Escritorio Ensayo/).click();
    await page.getByText(/90.*50.*75 cm/).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar cotización" }).click();
    await button("Preparar venta desde la cotización").click();
    await button("Cargar cotización").click();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await button("Programar retiro o entrega").click();
    await page.getByLabel("Modalidad").selectOption("delivery");
    await page.getByLabel("Dirección de entrega").fill("Calle de prueba móvil");
    await button("Guardar programación").click();
    await button("Completar entrega").click();
    await page.getByText(/Calle de prueba móvil · Completada/).waitFor();
    await button("Emitir constancia de despacho").click();
    await page.getByRole("heading", { name: "Constancia de despacho" }).waitFor();
    await page.getByText(/Dirección: Calle de prueba móvil/).waitFor();
    await open(businesses.furniture, "catalogo");
    await page.getByText(/^1 piezas?$/).waitFor();

    await open(businesses.ceramics, "cotizaciones");
    await button(/Revestimiento Ensayo/).click();
    await page.getByLabel("Área a cubrir (m²)").fill("12");
    await page.getByLabel("Merma (%)").fill("10");
    await page.getByText(/10 cajas necesarias · 13,2 m² con merma/).waitFor();
    await page.getByText(/Cobertura entregada · 14,4 m²/).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.equal(await dialog.getByRole("button", { name: "Confirmar cotización" }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => /^(Carrito|Revisar )/.test(document.activeElement?.textContent?.trim() ?? ""));
    await page.getByLabel("Tono de la cerámica").selectOption("Arena");
    await page.getByLabel("Calibre de la cerámica").selectOption("C1");
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar cotización" }).click();
    await page.getByRole("heading", { name: "Cotización confirmada" }).waitFor();

    await open(businesses.cement, "catalogo");
    await button("Abrir bolsas").click();
    assert.equal(await button("Elegir VENCIDO").count(), 0);
    await button("Elegir LOTE A").click();
    await page.getByText(/50 kg a granel.*50,00 de valor transferido/).waitFor();
    await button("Confirmar apertura").click();
    const identity = page.getByRole("dialog", { name: "Autorizar corrección" });
    await identity.getByLabel("Motivo de la corrección").fill("Preparar la venta a granel");
    await identity.getByLabel("Contraseña de tu cuenta").fill(password);
    await identity.getByRole("button", { name: "Confirmar identidad" }).click();
    await page.getByRole("heading", { name: "Apertura de bolsas confirmada" }).waitFor();
    await page.getByText("Valor transferido", { exact: true }).waitFor();
    const download = page.waitForEvent("download");
    await button("Guardar PDF").click();
    const file = await download;
    assert.match(file.suggestedFilename(), /^GR-.*\.pdf$/);
    assert.equal((await readFile(await file.path())).subarray(0, 5).toString(), "%PDF-");
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: cotización, venta y entrega de muebles; merma, tono y calibre con Escape; apertura de bolsas.");
  } finally {
    await browser.close();
  }
}
