import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { timberLabel } from "../web/src/timber/measures.ts";

export async function checkBrowser(cookies, available = 7) {
  const module = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);
  const browser = await module.chromium.launch({ channel: "msedge", headless: true });
  try {
    const base = "http://127.0.0.1:5283";
    const context = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true });
    await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: base })));
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.layoutErrors = [];
      window.addEventListener("error", (event) => {
        if (event.message.includes("ResizeObserver loop")) window.layoutErrors.push(event.message);
      });
    });
    await page.goto(base + "/?vista=ventas");
    assert.equal(await page.locator("body").evaluate((body) => getComputedStyle(body).fontWeight), "400");
    await page.getByRole("button", { name: /Tabla seca.*Pino/ }).click();
    await page.getByRole("button", { name: "Elegir medida disponible" }).click();
    const picked = timberLabel({ lengthMicros: 3_048_000_000, thicknessMicros: 50_800_000, widthMicros: 152_400_000 }, "metric");
    await page.getByRole("button", { name: "Elegir " + picked, exact: true }).click();
    await page.getByLabel("Piezas de la medida elegida").fill("100");
    await page.getByText("Pedido 100 · Disponible " + available + " · Faltan " + (100 - available)).waitFor();
    await page.getByRole("button", { name: "Revisar venta", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descuento total (Bs)").fill("5");
    await dialog.getByLabel("Referencia (opcional)").fill("Revisión del borrador");
    await dialog.getByRole("checkbox").check();
    assert.equal(await dialog.getByRole("button", { name: "Confirmar venta" }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => /^(Carrito|Revisar venta)$/.test(document.activeElement?.textContent?.trim() ?? ""));
    await page.getByLabel("Piezas de la medida elegida").fill("2");
    await page.getByText("Pedido 2 · Disponible " + available).waitFor();
    await page.getByRole("button", { name: "Revisar venta", exact: true }).click();
    assert.equal(await dialog.getByRole("button", { name: "Confirmar venta" }).isDisabled(), true);
    assert.equal(await dialog.getByLabel("Descuento total (Bs)").inputValue(), "5");
    assert.equal(await dialog.getByLabel("Referencia (opcional)").inputValue(), "Revisión del borrador");
    await dialog.getByLabel("Descuento total (Bs)").fill("0");
    assert.match(await dialog.innerText(), /200,00/);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar venta" }).click();
    await page.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    await page.getByText("50,8 mm × 152,4 mm × 3048 mm", { exact: false }).waitFor();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Guardar PDF" }).click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /\.pdf$/);
    assert.equal((await readFile(await download.path())).subarray(0, 4).toString(), "%PDF");

    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await page.getByRole("button", { name: "Iniciar práctica" }).click();
    const guide = page.getByRole("complementary", { name: "Guía de la práctica" });
    await guide.getByRole("heading", { name: "Abre la caja de práctica" }).waitFor();
    const move = guide.getByRole("button", { name: /Mover guía/ });
    const before = await guide.boundingBox();
    await move.focus();
    await page.keyboard.press("ArrowUp");
    const shifted = await guide.boundingBox();
    assert.ok(shifted.y < before.y);
    const handle = await move.boundingBox();
    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 10, handle.y - 15);
    await page.mouse.up();
    const dragged = await guide.boundingBox();
    assert.ok(dragged.y < shifted.y);
    await guide.getByRole("button", { name: "Minimizar" }).click();
    await guide.getByRole("button", { name: "Mostrar guía" }).click();
    await guide.getByRole("button", { name: "Ir a caja" }).click();
    await page.getByLabel("Fondo inicial (Bs)").fill("17");
    await page.getByRole("button", { name: "Confirmar apertura" }).click();
    await guide.getByRole("heading", { name: "Crea un producto de madera" }).waitFor();
    await page.reload();
    await guide.getByRole("heading", { name: "Crea un producto de madera" }).waitFor();
    await guide.getByRole("button", { name: "Pausar", exact: true }).click();
    await page.getByRole("button", { name: "Reanudar práctica" }).click();
    await guide.getByRole("heading", { name: "Crea un producto de madera" }).waitFor();
    await guide.getByRole("button", { name: "Abandonar", exact: true }).click();
    await guide.getByRole("button", { name: "Eliminar esta práctica" }).click();
    await page.getByText("Práctica eliminada.", { exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/?vista=catalogo");
    const search = page.getByLabel("Buscar en Almacén por nombre o código");
    await search.fill("MAD-000001");
    const record = page.getByRole("row", { name: /Costo por pie tablar/ });
    await record.getByRole("button", { name: "Ver existencias" }).click();
    await page.getByRole("heading", { name: "Movimientos de Costo por pie tablar" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Almacén", exact: true }).getAttribute("aria-pressed"), "true");

    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(base + "/?vista=compras");
    await page.getByRole("button", { name: /Costo por pie tablar.*Roble/ }).click();
    await page.getByLabel("Largo (mm)").fill("3048");
    await page.getByLabel("Espesor (mm)").fill("50.8");
    const widths = page.getByLabel("Anchos (mm)");
    await widths.fill("101.6, 127, 152.4, 177.8");
    await page.getByLabel("Costo por pie tablar (Bs)").fill("11");
    await page.getByText(/4 piezas.*403,33/).waitFor();
    await widths.fill("152.4, 177.8, 203.2, 228.6");
    await page.getByText(/4 piezas.*550,00/).waitFor();
    for (let group = 0; group < 4; group++) {
      await page.getByRole("button", { name: "Duplicar grupo", exact: true }).first().click();
    }
    const review = page.getByRole("button", { name: "Revisar compra", exact: true });
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 700 });
      for (const fraction of [0, .5, 1]) {
        await page.evaluate((portion) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * portion), fraction);
        await page.waitForFunction(() => {
          const bar = document.querySelector(".review-dock")?.getBoundingClientRect();
          const slot = document.querySelector(".review-slot")?.getBoundingClientRect();
          const mobile = matchMedia("(max-width: 640px)").matches;
          const nav = document.querySelector(".workspace-nav")?.getBoundingClientRect();
          return bar && slot && bar.top > 0 && bar.bottom <= (mobile && nav ? nav.top : innerHeight) &&
            bar.width <= (mobile ? 18 : 20) * parseFloat(getComputedStyle(document.documentElement).fontSize) + 1 &&
            bar.left > slot.left + 24 && Math.abs(bar.right - slot.right) < 2;
        });
        assert.ok(await review.isVisible());
      }
      const dock = page.locator(".review-dock");
      const expandedWidth = (await dock.boundingBox()).width;
      await page.getByRole("button", { name: "Minimizar barra", exact: true }).click();
      assert.ok((await dock.boundingBox()).width < expandedWidth);
      const toggle = page.getByRole("button", { name: "Mostrar", exact: true });
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await review.isVisible(), false);
      await toggle.click();
      assert.ok(await review.isVisible());
    }
    await page.setViewportSize({ width: 360, height: 640 });
    const remove = page.getByRole("button", { name: "Quitar grupo", exact: true });
    for (let group = 0; group < 4; group++) await remove.last().click();
    await page.getByRole("button", { name: "Historial de compras", exact: true }).click();
    assert.equal(await review.isVisible(), false);
    await page.getByRole("button", { name: "Registrar compra", exact: true }).click();
    assert.equal(await page.getByLabel("Costo por pie tablar (Bs)").inputValue(), "11");
    await page.getByRole("button", { name: "Revisar compra", exact: true }).click();
    await dialog.getByLabel("Forma de pago").selectOption("transfer");
    await dialog.getByLabel("Referencia (opcional)").fill("Revisión fija");
    let sent = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/commands")) sent++;
    });
    const scrollBefore = await page.evaluate(() => scrollY);
    await dialog.getByRole("button", { name: "Minimizar", exact: true }).tap();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Carrito");
    assert.equal(await page.evaluate(() => scrollY), scrollBefore);
    assert.equal(sent, 0);
    await review.click();
    assert.equal(await dialog.getByLabel("Forma de pago").inputValue(), "transfer");
    assert.equal(await dialog.getByLabel("Referencia (opcional)").inputValue(), "Revisión fija");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar compra", exact: true }).click();
    await page.getByRole("heading", { name: "Compra confirmada", exact: true }).waitFor();
    await page.getByText(/11,00 \/ pie tablar/).first().waitFor();
    assert.equal(await review.isVisible(), false);
    assert.equal(sent, 1);
    assert.deepEqual(await page.evaluate(() => window.layoutErrors), []);
    assert.deepEqual(errors, []);
    console.log("Edge a 360, 768 y 1440 px: revisión fija, barra minimizable, compra, faltante, Escape y conservación del borrador.");
  } finally {
    await browser.close();
  }
}
