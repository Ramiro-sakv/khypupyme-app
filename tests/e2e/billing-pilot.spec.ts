import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import { testAuthUrl, testProjectId } from "../emulator-environment";
import { DAY_MS, PASS_DAYS } from "../../shared/workspace/billing";

function nextBillingResponse(page: import("@playwright/test").Page, kind: string) {
  return page.waitForResponse((response) => response.url().endsWith("/workspaceBilling") &&
    response.request().postDataJSON()?.data?.kind === kind);
}

test("prueba, QR simulado, renovación desde otro navegador y solicitud de baja", async ({ page, context, request, browser, isMobile }) => {
  test.skip(process.env.VITE_BILLING_SIMULATION !== "true", "Requiere el entorno aislado de facturación.");
  const email = `piloto-${randomUUID()}@example.invalid`;
  const password = "khypupyme-piloto-seguro";
  const name = "Tienda piloto ficticia";
  await page.goto("/registro");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear negocio", exact: true }).first().click();
  await page.getByLabel("Nombre del negocio").fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar configuración" }).click();
  await page.getByRole("checkbox", { name: /confirmo este rubro/i }).check();
  await page.getByRole("button", { name: "Confirmar y comenzar" }).click();
  const entry = page.getByRole("heading", { name: "Elige un plan para tu negocio" });
  await expect(entry).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.locator('input[name="business-pass"]:checked')).toHaveCount(0);
  expect(await page.locator(".plan-options").evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(isMobile ? 1 : 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  const activate = page.getByRole("button", { name: "Activar prueba de 30 días" });
  await expect(activate).toBeDisabled();
  const verify = page.getByRole("button", { name: "Verificar correo", exact: true });
  await verify.click();
  await expect(page.getByText(/enlace enviado/i)).toBeVisible();
  const oob = await request.get(`${testAuthUrl}/emulator/v1/projects/${testProjectId}/oobCodes`);
  expect(oob.ok()).toBeTruthy();
  const codes = await oob.json() as { oobCodes: { email: string; requestType: string; oobCode: string }[] };
  const code = codes.oobCodes.find((entry) => entry.email === email && entry.requestType === "VERIFY_EMAIL");
  expect(code).toBeDefined();
  const verified = await request.post(`${testAuthUrl}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key`, { data: { oobCode: code!.oobCode } });
  expect(verified.ok()).toBeTruthy();
  await verify.click();
  await expect(activate).toBeEnabled();
  const activation = nextBillingResponse(page, "activate");
  await activate.click();
  const activated = await (await activation).json();
  expect(activated).toMatchObject({ result: { status: "trial", expiresAt: expect.any(Number) } });
  const trialEnd: number = activated.result.expiresAt;
  expect(trialEnd - activated.result.serverTime).toBeGreaterThan(30 * DAY_MS - 5000);
  expect(trialEnd - activated.result.serverTime).toBeLessThanOrEqual(30 * DAY_MS);
  await expect(entry).toHaveCount(0);
  await expect(page.getByText("Prueba activa", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Prueba activa", { exact: true })).toBeVisible();
  await expect(entry).toHaveCount(0);
  await page.getByRole("link", { name: "Ver plan" }).click();

  async function go(name: "Caja" | "Configuración") {
    if (!isMobile) {
      await page.getByRole("navigation", { name: "Herramientas del negocio" }).getByRole("button", { name, exact: true }).click();
    } else if (name === "Caja") {
      await page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("button", { name, exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Más", exact: true }).click();
      await page.getByRole("navigation", { name: "Más herramientas" }).getByRole("button", { name, exact: true }).click();
    }
  }

  // Captura el ID desde una consulta real para abrir el mismo negocio en otro navegador.
  await page.getByRole("radio", { name: /30 días/ }).check();
  const lookup = nextBillingResponse(page, "start");
  await page.getByRole("button", { name: "Generar QR ficticio" }).click();
  const payment = await (await lookup).json() as { result: { businessId: string; id: string; priceMinor: number } };
  expect(payment.result.priceMinor).toBe(3900);
  await expect(page.getByText("Simulación local · sin cobro real")).toBeVisible();
  await page.getByRole("radio", { name: /6 meses/ }).check();
  await expect(page.getByText(/Simula su vencimiento antes de elegir otro pase/)).toBeVisible();
  await page.getByRole("button", { name: "Simular vencimiento" }).click();
  await expect(page.getByText(/la solicitud venció/i)).toBeVisible();
  await page.getByRole("radio", { name: /30 días/ }).check();
  await page.getByRole("button", { name: "Generar QR ficticio" }).click();
  await expect(page.getByRole("button", { name: "Simular pago", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plan del negocio" })).toBeVisible();
  await expect(page.getByText(/QR pendiente · 30 días/)).toBeVisible();

  const other = await browser.newContext();
  try {
    await other.route(/^http:\/\/(127\.0\.0\.1|localhost):(8080|9099|5001)\//, (route) => route.abort("blockedbyclient"));
    const portal = await other.newPage();
    await portal.goto("/pago/" + payment.result.businessId);
    await portal.getByRole("link", { name: "Ingresar para pagar" }).click();
    await portal.getByLabel("Correo electrónico").fill(email);
    await portal.getByLabel("Contraseña", { exact: true }).fill(password);
    await portal.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(portal.getByRole("heading", { name: "Pago de " + name })).toBeVisible();
    await portal.getByRole("button", { name: "Consultar pago", exact: true }).click();
    await portal.getByRole("button", { name: "Simular pago", exact: true }).click();
    await expect(portal.getByText(/pago confirmado/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Consultar pago", exact: true })).toBeEnabled();
    const renewal = nextBillingResponse(page, "plan");
    await page.getByRole("button", { name: "Consultar pago", exact: true }).click();
    await expect(page.getByText(/pago confirmado/i)).toBeVisible();
    expect(await (await renewal).json()).toMatchObject({ result: { expiresAt: trialEnd + PASS_DAYS * DAY_MS } });
    await portal.getByRole("button", { name: "Simular reembolso" }).click();
    await expect(portal.getByText(/el pago fue devuelto/i)).toBeVisible();
    const refund = nextBillingResponse(page, "plan");
    await page.getByRole("button", { name: "Consultar pago", exact: true }).click();
    await expect(page.getByText(/el pago fue devuelto/i)).toBeVisible();
    expect(await (await refund).json()).toMatchObject({ result: { expiresAt: trialEnd } });
    await expect(page.getByText("Prueba activa", { exact: true })).toBeVisible();
  } finally { await other.close(); }

  await go("Caja");
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
  await go("Configuración");
  await page.getByRole("button", { name: "Simular fin de la prueba" }).click();
  await expect(entry).toBeVisible();
  await expect(page.getByText("Modo de consulta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Entrar en modo de consulta" }).click();
  await go("Configuración");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar datos" }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, "utf8"));
  expect(exported).toMatchObject({
    business: { name }, collections: { cashSessions: [{ status: "open" }] },
  });
  await go("Caja");
  await expect(page.getByRole("button", { name: "Registrar aporte o retiro" })).toBeDisabled();
  await page.getByText("Cerrar y conciliar esta caja", { exact: true }).click();
  await page.getByLabel("Efectivo contado (BOB)").fill("0");
  await page.getByRole("button", { name: "Cerrar caja y emitir comprobante" }).click();
  await expect(page.getByRole("button", { name: "Abrir caja", exact: true })).toBeDisabled();
  await go("Configuración");

  await page.getByRole("button", { name: "Cambiar negocio", exact: true }).click();
  await page.getByRole("button", { name: "Crear negocio", exact: true }).click();
  await page.getByLabel("Nombre del negocio").fill("Segundo negocio ficticio");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar configuración" }).click();
  await page.getByRole("checkbox", { name: /confirmo este rubro/i }).check();
  await page.getByRole("button", { name: "Confirmar y comenzar" }).click();
  await expect(entry).toBeVisible();
  await expect(page.getByText("Modo de consulta", { exact: true })).toBeVisible();
  await expect(activate).toHaveCount(0);
  await page.getByRole("button", { name: "Entrar en modo de consulta" }).click();
  await go("Caja");
  await expect(page.getByRole("button", { name: "Abrir caja", exact: true })).toBeDisabled();

  const tab = await context.newPage();
  await tab.goto("/eliminar-cuenta");
  await tab.getByLabel("Confirma tu contraseña").fill(password);
  await tab.getByRole("checkbox").check();
  await tab.getByRole("button", { name: "Solicitar eliminación", exact: true }).click();
  await expect(tab.getByText(/solicitud recibida/i)).toBeVisible();
  await tab.close();
});
