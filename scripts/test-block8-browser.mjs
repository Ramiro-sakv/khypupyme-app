import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function checkBrowser(cookies, businesses, trial) {
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

    const plan = (name) => page.getByRole("heading", { name, exact: true });
    await open(businesses.browserBusiness);
    await plan("Plan de Negocio de checkout visual").waitFor();
    await page.getByText("Demostración · Sin cargos", { exact: true }).waitFor();
    await button("Elegir 6 meses").click();
    await plan("Revisar pase").waitFor();
    await page.getByText("6 meses calendario", { exact: true }).waitFor();
    await button("Continuar al pago").click();
    await plan("Pago con tarjeta de demostración").waitFor();
    assert.equal(await page.getByRole("textbox").count(), 0);
    await page.getByRole("radio", { name: /Mastercard.*4444/ }).check();
    await button("Preparar pago de prueba").click();
    await plan("Pago pendiente").waitFor();
    await page.reload();
    await plan("Pago pendiente").waitFor();
    await button("Confirmar pago de prueba").click();
    await plan("Pago aprobado").waitFor();
    await button("Ir al negocio").click();
    await page.getByText("Plan vigente", { exact: true }).waitFor();
    await page.reload();
    await plan("Negocio de checkout visual").waitFor();

    await page.getByRole("button", { name: "Plan del negocio", exact: true }).click();
    await button("Simular reembolso").click();
    await button("Confirmar reembolso de prueba").click();
    await plan("Pago reembolsado").waitFor();
    await button("Entrar en modo de consulta").click();
    await page.getByText("Modo de consulta", { exact: true }).waitFor();

    await open(businesses.first);
    await plan("Plan de Primer negocio de prueba").waitFor();
    assert.equal(await button("Activar prueba").count(), 0);
    await button("Entrar en modo de consulta").click();
    await page.getByText("Modo de consulta", { exact: true }).waitFor();
    await page.locator("summary").filter({ hasText: "Más" }).click();
    await page.getByRole("link", { name: "Historial", exact: true }).click();
    const exportEvent = page.waitForEvent("download");
    await button("Descargar mis datos").click();
    const exportFile = await exportEvent;
    const data = JSON.parse(await readFile(await exportFile.path(), "utf8"));
    assert.equal(data.business.id, businesses.first);
    assert.ok(data.operations.some((event) => event.kind === "sale"));
    await page.getByRole("row", { name: /Venta/ }).getByRole("button", { name: "Ver detalle" }).click();
    const pdfEvent = page.waitForEvent("download");
    await button("Guardar PDF").click();
    const pdf = await pdfEvent;
    assert.equal((await readFile(await pdf.path())).subarray(0, 5).toString(), "%PDF-");

    await open(businesses.secondary);
    await button("Elegir 30 días").click();
    await button("Continuar al pago").click();
    await page.getByRole("radio", { name: /0002/ }).check();
    await button("Preparar pago de prueba").click();
    await button("Confirmar pago de prueba").click();
    await plan("Tarjeta rechazada").waitFor();

    await context.clearCookies();
    await context.addCookies([...trial.cookies].map(([name, value]) => ({ name, value, url: base })));
    await open(trial.id);
    await button("Activar prueba").click();
    await button("Confirmar prueba gratuita").click();
    await page.getByRole("status").getByText("Prueba activada por 30 días.").waitFor();
    await button("Ir al negocio").click();
    await plan("Negocio para activar prueba").waitFor();
    assert.deepEqual(errors, []);
    console.log("Edge a 360 px: revisión, recuperación al recargar, aprobación, reembolso, rechazo y descargas fuera de vigencia.");
  } finally {
    await browser.close();
  }
}
