import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

async function debugPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function checkWindows({ email, password, business }) {
  const { chromium } = await import(pathToFileURL(process.env.KHYPU_TEST_PLAYWRIGHT).href);
  const host = process.env.KHYPU_TEST_WEB_ORIGIN;
  const pin = process.env.KHYPU_TEST_CERT_PIN;
  assert.equal(host, "https://localhost:7243");
  assert.match(pin, /^[A-Za-z0-9+/]{43}=$/);
  const directory = await mkdtemp(join(tmpdir(), "khypupyme-pilot-win-"));
  const driver = await chromium.launch({ channel: "msedge", headless: true });
  const context = await driver.newContext({ ignoreHTTPSErrors: true });
  let processHandle;
  async function boot() {
    const port = await debugPort();
    const address = "http://127.0.0.1:" + port;
    const profile = await mkdtemp(join(directory, "webview-"));
    processHandle = spawn(process.env.KHYPU_TEST_WINDOWS, [], { windowsHide: true, env: {
      ...process.env, WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=" + port
        + " --ignore-certificate-errors-spki-list=" + pin,
    } });
    let browser;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if ((await fetch(address + "/json/version")).ok) {
          browser = await chromium.connectOverCDP(address, { timeout: 3000 });
          break;
        }
      } catch { /* waiting for WebView2 */ }
      await delay(250);
    }
    assert.ok(browser, "WebView2 no abrió el canal de verificación.");
    const windows = browser.contexts()[0];
    const app = windows.pages()[0] ?? await windows.waitForEvent("page");
    app.setDefaultTimeout(12_000);
    app.setDefaultNavigationTimeout(12_000);
    await app.waitForURL("https://tauri.localhost/");
    return app;
  }
  async function stop() {
    if (!processHandle || processHandle.exitCode !== null) return;
    const stopped = new Promise((resolve) => processHandle.once("exit", resolve));
    processHandle.kill();
    await stopped;
  }
  async function login(app) {
    const requests = [];
    const failed = (request) => requests.push(new URL(request.url()).pathname + " " + request.failure()?.errorText);
    const completed = (response) => {
      const path = new URL(response.url()).pathname;
      if (path === "/connect/token" || path === "/api/v1/auth/native-session") requests.push(path + " " + response.status());
    };
    app.on("requestfailed", failed);
    app.on("response", completed);
    const priorState = await app.evaluate(async () => {
      const raw = await window.__TAURI_INTERNALS__.invoke("native_load", { name: "handshake" });
      return raw ? JSON.parse(raw).state : null;
    });
    await app.getByRole("button", { name: "Ingresar con el navegador" }).click();
    const handle = await app.waitForFunction(async (previous) => {
      const raw = await window.__TAURI_INTERNALS__.invoke("native_load", { name: "handshake" });
      const current = raw ? JSON.parse(raw) : null;
      return current && current.state !== previous ? current : null;
    }, priorState);
    const local = await handle.jsonValue();
    await handle.dispose();
    const challenge = createHash("sha256").update(local.verifier).digest("base64url");
    const params = new URLSearchParams({ client_id: "khypupyme2-windows", response_type: "code",
      redirect_uri: "http://127.0.0.1:43823/callback", scope: "offline_access khypupyme_api",
      state: local.state, code_challenge: challenge, code_challenge_method: "S256", prompt: "login" });
    const web = await context.newPage();
    try {
      await web.goto(host + "/connect/authorize?" + params);
      await web.getByLabel(/correo/i).fill(email);
      await web.getByLabel("Contraseña", { exact: true }).fill(password);
      await web.getByRole("button", { name: "Ingresar", exact: true }).click();
      await web.waitForURL("http://127.0.0.1:43823/callback?**");
      await web.getByText("Ya puedes volver a KhypuPyme.").waitFor();
      await app.getByRole("heading", { name: "Mis negocios", exact: true })
        .or(app.getByRole("navigation", { name: "Navegación del negocio" }))
        .or(app.getByRole("button", { name: "Volver a mis negocios", exact: true })).waitFor();
    } catch (failure) {
      const alerts = await app.getByRole("alert").allTextContents();
      console.error("Windows: estado del retorno", { requests, alerts });
      throw failure;
    } finally {
      app.off("requestfailed", failed);
      app.off("response", completed);
      await web.close();
    }
  }
  try {
    let app = await boot();
    await login(app);
    const businesses = app.getByRole("link", { name: "Mis negocios", exact: true })
      .or(app.getByRole("button", { name: "Volver a mis negocios", exact: true }));
    if (await businesses.isVisible()) await businesses.click();
    await app.getByRole("button", { name: /Primer negocio de prueba/ }).click();
    await app.getByText("Plan vigente", { exact: true }).waitFor();
    await app.getByRole("link", { name: "Ventas", exact: true }).click();
    await app.getByRole("button", { name: /Termo de prueba/ }).click();
    await app.getByRole("button", { name: "Revisar venta", exact: true }).click();
    const review = app.getByRole("dialog");
    await review.getByLabel("Forma de pago").selectOption("qr");
    await review.getByRole("checkbox").check();
    const write = app.waitForResponse((response) => response.url() === host + "/api/v1/businesses/" + business + "/commerce/commands"
      && response.request().method() === "POST");
    await review.getByRole("button", { name: "Confirmar venta" }).click();
    assert.equal((await write).status(), 200);
    await app.getByRole("heading", { name: "Venta confirmada" }).waitFor();
    const save = app.getByRole("button", { name: "Guardar PDF" });
    const target = process.env.KHYPU_TEST_SAVE_WINDOWS_PDF;
    if (target) {
      console.log("Guarda el PDF con el diálogo de Windows en " + target);
      await save.click({ noWaitAfter: true });
      let saved;
      for (let attempt = 0; attempt < 600 && !saved; attempt++) {
        try { saved = await readFile(target); } catch (failure) { if (failure.code !== "ENOENT") throw failure; }
        if (!saved) await delay(250);
      }
      assert.equal(saved?.subarray(0, 5).toString(), "%PDF-");
      console.log("Windows/WebView2 local: PDF guardado mediante el diálogo nativo.");
    } else {
      await app.evaluate(() => {
        const ipc = window.__TAURI_INTERNALS__;
        const invoke = ipc.invoke;
        window.verifiedPdf = null;
        ipc.invoke = (command, args, ...options) => {
          if (command !== "native_save_file") return invoke.call(ipc, command, args, ...options);
          window.verifiedPdf = { name: args.name, header: atob(args.content).slice(0, 5) };
          return Promise.resolve();
        };
      });
      await save.click();
      const pdf = await app.waitForFunction(() => window.verifiedPdf);
      const file = await pdf.jsonValue();
      await pdf.dispose();
      assert.match(file.name, /\.pdf$/i);
      assert.equal(file.header, "%PDF-");
      console.log("Windows/WebView2 local: PDF verificado en la llamada al guardado nativo.");
    }
    await stop();
    app = await boot();
    await app.getByRole("link", { name: "Configuración", exact: true }).click();
    await app.getByText(email, { exact: true }).waitFor();
    await app.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await login(app);
    console.log("Windows/WebView2 local: regreso por loopback, licencia, venta, comprobante y segundo ingreso tras reabrir.");
  } finally {
    await stop();
    await driver.close();
  }
}
