import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function checkPolish(cookies, businessId, number) {
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
    console.log("Edge a 1440 y 360 px: fotografía, 21 rubros, borrador del asistente, atajo, navegación, búsqueda y PDF de informes.");
  } finally { await browser.close(); }
}
