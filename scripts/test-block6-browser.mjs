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
    const button = (name) => page.getByRole("button", { name });
    const dialog = page.getByRole("dialog");

    async function open(id, view = "inicio") {
      const { token } = await (await context.request.get(base + "/api/v1/auth/csrf")).json();
      const selection = await context.request.put(base + "/api/v1/businesses/" + id + "/selection", { headers: { "X-CSRF-TOKEN": token } });
      assert.equal(selection.status(), 204);
      await page.goto(base + "/?vista=" + view);
    }

    await open(businesses.store);
    await page.getByRole("heading", { name: "Reposición y vencimientos" }).waitFor();
    await button("Venta rápida con lector").click();
    const scanner = page.getByRole("textbox", { name: "Código o lector" });
    await scanner.fill("BEB-24");
    await scanner.press("Enter");
    await page.getByText("Soda añadido.").waitFor();
    assert.equal(await scanner.evaluate((field) => field === document.activeElement), true);
    await page.getByRole("textbox", { name: "Cantidad", exact: true }).fill("44");
    await page.getByText(/Pedido 44 · Disponible 43 unidades · Faltan 1/).waitFor();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.equal(await dialog.getByRole("button", { name: "Confirmar venta" }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => /^(Carrito|Revisar )/.test(document.activeElement?.textContent?.trim() ?? ""));

    await open(businesses.clothes);
    await page.getByRole("heading", { name: "Tallas, colores y cambios" }).waitFor();
    await button("Buscar venta para un cambio").click();
    await button("Ver detalle").click();
    await button("Iniciar cambio").click();
    const unavailable = button(/Talla L, Azul, 0 disponibles/);
    await unavailable.waitFor();
    assert.equal(await unavailable.isDisabled(), true);
    await button(/Talla M, Negro, 2 disponibles/).click();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    assert.match(await dialog.innerText(), /10,00/);
    await dialog.getByLabel("Motivo del cambio").fill("Prueba de cambio en móvil");
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar cambio" }).click();
    const identity = page.getByRole("dialog", { name: "Autorizar corrección" });
    await identity.getByLabel("Contraseña de tu cuenta").fill(password);
    await identity.getByRole("button", { name: "Confirmar identidad" }).click();
    await page.getByRole("heading", { name: "Cambio de prenda confirmado" }).waitFor();

    await open(businesses.appliances);
    await page.getByRole("heading", { name: "Garantías e inspecciones" }).waitFor();
    await button("Recibir equipos por serie").click();
    await button(/Refrigerador/).click();
    await page.getByLabel("Series recibidas").fill("EQ-030\nEQ-031");
    await page.getByLabel("Costo por equipo (Bs)").fill("1000");
    await page.getByText(/Subtotal ·.*2\.000,00/).waitFor();
    await open(businesses.appliances, "ventas");
    await button(/Refrigerador/).click();
    await page.getByLabel("EQ-002", { exact: true }).check();
    await button(/^Revisar (venta|compra|cotización|entrada|cambio)$/).click();
    await dialog.getByLabel("Forma de pago").selectOption("qr");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await button("Historial de la serie").click();
    await page.getByRole("heading", { name: "Serie EQ-002", exact: true }).waitFor();
    await page.getByText(/Garantía declarada hasta/).waitFor();
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: lector y revisión, matriz y cambio, captura y venta por serie, historial y garantía.");
  } finally {
    await browser.close();
  }
}
