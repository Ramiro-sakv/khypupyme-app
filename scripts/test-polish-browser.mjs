import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function checkPolish(cookies, businessId, number, purchaseNumber) {
  const base = "http://127.0.0.1:5283";
  const { chromium } = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 880 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    const button = (name) => page.getByRole("button", { name, exact: true });
    await page.goto(base);
    await page.getByRole("heading", { name: "Ingresa a KhypuPyme" }).waitFor();
    assert.equal(await page.locator(".intro img").evaluate((img) => img.complete && img.naturalWidth > 0), true);
    await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: base })));
    await page.goto(base + "/?vista=crear");
    await page.getByRole("radio", { name: "Maderas y barraca", exact: true }).waitFor();
    assert.equal(await page.getByRole("radio").count(), 21);
    await page.getByRole("radio", { name: "Maderas y barraca", exact: true }).check();
    await page.getByRole("heading", { name: "Maderas y barraca", exact: true }).waitFor();
    await button("Continuar").click();
    await page.getByLabel("Nombre del negocio", { exact: true }).fill("Borrador visual");
    await button("Atrás").click();
    await button("Continuar").click();
    assert.equal(await page.getByLabel("Nombre del negocio", { exact: true }).inputValue(), "Borrador visual");

    const { token } = await (await context.request.get(base + "/api/v1/auth/csrf")).json();
    assert.equal((await context.request.put(base + "/api/v1/businesses/" + businessId + "/selection",
      { headers: { "X-CSRF-TOKEN": token } })).status(), 204);
    await page.goto(base + "/?vista=inicio");
    await page.getByRole("heading", { name: "Últimos siete días" }).waitFor();
    const title = page.getByRole("heading", { name: "Núcleo comercial de prueba", exact: true });
    await title.focus();
    await page.keyboard.press("Alt+Shift+A");
    await page.getByRole("heading", { name: "Ayuda", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Atajos de teclado", exact: true }).waitFor();

    const route = (view) => page.goto(base + "/?vista=" + view);
    const heading = (name) => page.getByRole("heading", { name, exact: true });
    async function imageFor(area) {
      const img = page.locator(`.operation-hero[data-area="${area}"] img`);
      await img.waitFor();
      assert.equal(await img.evaluate((asset) => asset.decode().then(() => asset.naturalWidth)), 760);
      assert.equal(await page.getByRole("button", { name: "Seguridad de cuenta", exact: true }).count(), 0);
    }

    await route("compras");
    await imageFor("purchase");
    const titleBox = await heading("Compra nueva").boundingBox();
    assert.ok(titleBox && titleBox.y < 220);
    const catalogBox = await page.locator(".trade-catalog").boundingBox();
    const cartBox = await page.locator(".trade-cart").boundingBox();
    assert.ok(catalogBox && cartBox && cartBox.x > catalogBox.x + catalogBox.width && cartBox.y === catalogBox.y);
    const product = page.getByRole("button", { name: /Nombre nuevo QA/ });
    await product.click();
    const quantity = page.getByRole("spinbutton", { name: "Piezas de Nombre nuevo QA", exact: true });
    await quantity.fill("2");
    await button("Historial de compras").click();
    await heading("Historial de compras").waitFor();
    await page.getByLabel("Número, cliente o referencia").fill(purchaseNumber);
    await button("Buscar").click();
    const purchaseRow = page.getByRole("row", { name: new RegExp(purchaseNumber) });
    await purchaseRow.getByRole("button", { name: "Ver detalle" }).click();
    await button("Volver").click();
    await heading("Historial de compras").waitFor();
    await button("Registrar compra").click();
    assert.equal(await quantity.inputValue(), "2");

    await route("ventas");
    await imageFor("sale");
    await button("Historial de ventas").click();
    await heading("Historial de ventas").waitFor();
    await page.getByText("Devolución", { exact: true }).first().waitFor();

    await page.setViewportSize({ width: 768, height: 880 });
    await route("caja");
    await imageFor("cash");
    const closed = page.getByRole("row", { name: /Cerrada/ });
    await closed.getByRole("button", { name: /Ver movimientos/ }).click();
    await page.getByRole("region", { name: "Registro de movimientos de efectivo" })
      .getByRole("row", { name: new RegExp(purchaseNumber) }).waitFor();
    await button("Volver a la última sesión").click();
    assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth), true);

    await page.setViewportSize({ width: 360, height: 780 });
    await route("catalogo");
    await imageFor("inventory");
    const startEditor = button("Nuevo producto");
    await startEditor.click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Nombre del producto" }).fill("Producto sin registrar");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await startEditor.evaluate((item) => item === document.activeElement), true);
    assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth), true);
    await route("configuracion");
    await button("Seguridad de cuenta").click();
    await button("Cerrar panel").click();

    await page.setViewportSize({ width: 360, height: 780 });
    await page.locator(".mobile-nav-more summary").click();
    await page.getByRole("link", { name: "Documentos", exact: true }).filter({ visible: true }).click();
    await page.getByLabel("Número, cliente o referencia").fill(number);
    await button("Buscar").click();
    await page.getByRole("row", { name: new RegExp(number) }).waitFor();
    assert.equal(await page.getByRole("row").count(), 2);
    assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth), true);

    await page.goto(base + "/?vista=informes");
    await page.getByLabel("Mostrar compras de mercadería").check();
    await page.getByRole("region", { name: "Importes seleccionados" }).waitFor();
    const output = page.waitForEvent("download");
    await button("Guardar informe PDF").click();
    assert.equal((await readFile(await (await output).path())).subarray(0, 5).toString(), "%PDF-");
    assert.deepEqual(problems, []);
    console.log("Edge a 1440, 768 y 360 px: cuatro fotos, compra con borrador e historial, ventas y devoluciones, sesiones de Caja, panel con Escape y PDF.");
  } finally { await browser.close(); }
}
