import assert from "node:assert/strict";
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
      const response = await context.request.put(base + "/api/v1/businesses/" + id + "/selection", { headers: { "X-CSRF-TOKEN": token } });
      assert.equal(response.status(), 204);
      await page.goto(base + "/?vista=" + view);
    }

    await open(businesses.grocery, "compras");
    const barcode = page.getByLabel("Código o lector");
    await barcode.fill("SAL-24");
    await barcode.press("Enter");
    assert.equal(await page.getByLabel("Unidad", { exact: true }).inputValue(), "box");
    await page.getByLabel("Cantidad", { exact: true }).fill("2");
    await page.getByText(/Equivale a 48 unidad/).waitFor();

    await open(businesses.beverages);
    await button("Gestionar envases").click();
    await page.getByLabel("Cliente del movimiento").selectOption({ label: "Cliente ficticio QA" });
    const returned = page.getByLabel("Devueltos de Botella retornable", { exact: true });
    await returned.fill("8");
    await page.getByText(/tenía 7 y quieres devolver 8/).waitFor();
    assert.equal(await button("Confirmar movimiento").isDisabled(), true);
    await returned.fill("1");
    await button("Confirmar movimiento").click();
    await page.getByRole("heading", { name: "Movimiento de envases confirmado" }).waitFor();

    await open(businesses.beverages, "ventas");
    await barcode.fill("BOT-24");
    await barcode.press("Enter");
    await page.getByLabel("Unidad", { exact: true }).selectOption("box");
    await page.getByLabel("Unidades sueltas").fill("1");
    await page.getByText(/Equivale a 25 unidad/).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByText("Elegir cliente registrado").click();
    await dialog.getByRole("button", { name: "Cliente ficticio QA", exact: true }).click();
    await dialog.getByText("Envases entregados y devueltos").click();
    await dialog.getByLabel("Entregados de Botella retornable").fill("2");
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await page.getByText("1 caja + 1 suelta", { exact: true }).waitFor();
    await page.getByRole("region", { name: "Envases", exact: true }).getByText("Botella retornable").waitFor();

    await open(businesses.cosmetics, "catalogo");
    const search = page.getByLabel("Buscar por marca, presentación o tono");
    await search.fill("Coral");
    await search.press("Enter");
    await page.getByText("12 meses tras apertura", { exact: true }).waitFor();
    await button("Ver existencias").click();
    await page.getByRole("row", { name: /C-VISUAL/ }).getByRole("button", { name: "Gestionar lote" }).click();
    await page.getByLabel("Motivo de la corrección").fill("Revisión del sello");
    await button("Confirmar cambio de lote").click();
    const identity = page.getByRole("dialog", { name: "Autorizar corrección" });
    await identity.getByLabel("Contraseña de tu cuenta").fill(password);
    await identity.getByRole("button", { name: "Confirmar identidad" }).click();
    await page.getByRole("heading", { name: "Lote apartado", exact: true }).waitFor();
    await page.getByText("Revisión del sello", { exact: true }).waitFor();

    await open(businesses.pets, "ventas");
    await button(/Alimento a granel/).click();
    await page.getByLabel("Lote de origen").selectOption("BOLSA-B");
    await page.getByText(/Faltan 0,5/).waitFor();
    await page.getByLabel("Cantidad", { exact: true }).fill("0.25");
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await page.getByText(/Lote BOLSA-B/).waitFor();
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: compra por caja, venta con envases y devolución separada, búsqueda y gestión del lote, fraccionamiento con origen.");
  } finally {
    await browser.close();
  }
}
