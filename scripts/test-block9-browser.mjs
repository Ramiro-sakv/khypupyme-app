import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function checkBrowser(cookies, business, product, readCode) {
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
    async function open(id, view = "inicio") {
      const { token } = await (await context.request.get(base + "/api/v1/auth/csrf")).json();
      assert.equal((await context.request.put(base + "/api/v1/businesses/" + id + "/selection",
        { headers: { "X-CSRF-TOKEN": token } })).status(), 204);
      await page.goto(base + "/?vista=" + view);
    }

    await open(business, "catalogo");
    await button("Catálogo").click();
    await button("Editar").click();
    await page.getByLabel("Nombre del producto").fill("Edición que se abandona");
    await button("Guardar").click();
    await page.getByRole("dialog", { name: "Autorizar corrección" }).waitFor();
    await page.reload();
    await page.getByRole("row", { name: /Producto del navegador/ }).waitFor();
    assert.equal(await button("Consultar estado").count(), 0);

    await button("Editar").click();
    await page.getByLabel("Nombre del producto").fill("Ficha protegida");
    await button("Guardar").click();
    const dialog = page.getByRole("dialog", { name: "Autorizar corrección" });
    await dialog.getByText(/Cuenta separada · Edición de ficha/).waitFor();
    await dialog.getByLabel("Motivo de la corrección").fill("Corrección desde móvil");
    await dialog.getByLabel("Contraseña de tu cuenta").fill("Clave de ejemplo de bloque nueve 2026!");
    const written = page.waitForResponse((response) => response.url().endsWith("/commerce/commands") &&
      response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Confirmar identidad" }).click();
    const response = await written;
    assert.equal(response.status(), 200, await response.text());
    await page.getByRole("row", { name: /Ficha protegida/ }).waitFor();
    const record = await context.request.get(base + "/api/v1/businesses/" + business + "/commerce/products/" + product);
    assert.equal((await record.json()).name, "Ficha protegida");

    await open(business, "configuracion");
    await button("Ver auditoría").click();
    await page.getByText(/Corrección desde móvil/).waitFor();
    await button("Eliminar Cuenta separada").click();
    await page.getByLabel("Nombre exacto del negocio").fill("cuenta separada");
    assert.equal(await button("Confirmar identidad para borrar").isDisabled(), true);
    await page.getByLabel("Nombre exacto del negocio").fill("Cuenta separada");
    await button("Confirmar identidad para borrar").click();
    const identity = page.getByRole("dialog", { name: "Confirma tu identidad" });
    await identity.getByLabel("Contraseña de tu cuenta").fill("Clave de ejemplo de bloque nueve 2026!");
    await identity.getByRole("button", { name: "Confirmar identidad" }).click();
    await button("Enviar código de eliminación").click();
    await page.getByLabel("Código de eliminación").waitFor();
    await page.getByLabel("Código de eliminación").fill(readCode());
    const resume = "**/api/v1/security/businesses/" + business + "/resume";
    await page.route(resume, (route) => route.abort());
    await button("Confirmar borrado definitivo").click();
    await button("Reanudar eliminación").waitFor();
    await page.reload();
    await page.unroute(resume);
    await button("Reanudar eliminación").click();
    await page.getByText("Negocio eliminado.", { exact: true }).waitFor();
    assert.equal((await context.request.get(base + "/api/v1/businesses/" + business)).status(), 404);
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: contraseña y motivo en edición, auditoría visible, código y reanudación tras interrumpir la limpieza.");
  } finally {
    await browser.close();
  }
}
