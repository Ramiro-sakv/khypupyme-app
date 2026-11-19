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

    await open(businesses.footwear);
    await page.getByRole("heading", { name: "Tallas, colores y cambios" }).waitFor();
    await button("Vender por talla").click();
    await button(/Zapato Andino/).click();
    await button(/Talla 40, Negro, 2 pares disponibles/).click();
    await page.getByLabel("Pares de Zapato", { exact: true }).fill("1");
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await page.getByText("1 par", { exact: true }).waitFor();
    await button("Iniciar cambio").click();
    await page.getByLabel("Pares para cambiar").waitFor();
    assert.equal(await button(/Talla 41, Negro, 0 pares disponibles/).isDisabled(), true);
    await button("Cancelar cambio").click();

    await open(businesses.electronics);
    await button("Vender accesorios y equipos").click();
    await button(/Cable USB/).click();
    await button(/Tableta/).click();
    await page.getByLabel("EL-002", { exact: true }).check();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.match(await dialog.innerText(), /825,00/);
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await button("Historial de la serie").click();
    await page.getByRole("heading", { name: "Serie EL-002", exact: true }).waitFor();

    await open(businesses.hardware, "compras");
    const scanner = page.getByLabel("Código o lector");
    await scanner.fill("CAB-4");
    await scanner.press("Enter");
    assert.equal(await page.getByLabel("Unidad", { exact: true }).inputValue(), "roll");
    await page.getByLabel("Cantidad", { exact: true }).fill("2");
    await page.getByLabel("Costo por rollo (Bs)").fill("100");
    await page.getByText("Equivale a 100 m", { exact: true }).waitFor();
    await open(businesses.hardware, "ventas");
    await scanner.fill("CAB-4");
    await scanner.press("Enter");
    await page.getByText(/Estante A-03/).waitFor();
    await page.getByLabel("Cantidad", { exact: true }).fill("91");
    await page.getByText(/Faltan 1/).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.equal(await dialog.getByRole("button", { name: "Confirmar venta" }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => /^(Carrito|Revisar )/.test(document.activeElement?.textContent?.trim() ?? ""));

    await open(businesses.parts, "catalogo");
    await page.getByLabel("Filtrar marca de vehículo").fill("Toyota");
    await page.getByLabel("Filtrar modelo de vehículo").fill("Hilux");
    await page.getByLabel("Año del vehículo").fill("2022");
    await button("Filtrar compatibilidad").click();
    await page.getByRole("row", { name: /Filtro corregido/ }).waitFor();
    await page.getByLabel("Año del vehículo").fill("2012");
    await button("Filtrar compatibilidad").click();
    await page.getByText("Todavía no hay registros", { exact: true }).waitFor();
    await button("Quitar filtro").click();
    await page.getByRole("row", { name: /Correa/ }).getByText(/Compatibilidad por confirmar/).waitFor();

    await open(businesses.stationery, "ventas");
    await scanner.fill("IMP-A4");
    await scanner.press("Enter");
    await page.getByLabel("Número de copias").fill("3");
    await page.getByLabel("Caras por copia").fill("5");
    await page.getByLabel("Modo de impresión").selectOption("duplex");
    await page.getByText("15 caras impresas · 9 hojas", { exact: true }).waitFor();
    await scanner.fill("LAP-1");
    await scanner.press("Enter");
    await page.getByLabel("Piezas de Lápiz").fill("2");
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.match(await dialog.innerText(), /10,50/);
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await page.getByText("15 caras", { exact: true }).waitFor();
    await page.getByText(/15 caras impresas · 9 hojas/).waitFor();
    const downloaded = page.waitForEvent("download");
    await button("Guardar PDF").click();
    const file = await downloaded;
    assert.equal((await readFile(await file.path())).subarray(0, 4).toString(), "%PDF");
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: pares y cambio, venta mixta por serie, rollos y faltante, filtro por vehículo e impresión doble cara con PDF.");
  } finally { await browser.close(); }
}
