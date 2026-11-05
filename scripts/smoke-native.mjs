import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const [endpoint, target] = process.argv.slice(2);
if (
  !/^http:\/\/127\.0\.0\.1:922[56]$/.test(endpoint ?? '') ||
  !['windows', 'android'].includes(target)
)
  throw new Error('Usa el WebView local de prueba en 9225/9226.');
const browser = await chromium.connectOverCDP(endpoint);
try {
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent('page'));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('heading', { name: 'Tu negocio, en orden.' }).waitFor({ timeout: 30000 });
  await page.getByRole('link', { name: 'Crear una cuenta' }).click();
  await page.getByRole('heading', { name: 'Empecemos con tu negocio' }).waitFor();
  if (!page.url().includes('#/registro'))
    throw new Error('La navegación nativa no usa rutas empaquetadas.');
  if (errors.length) throw new Error(`Errores de interfaz: ${errors.length}`);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/native-${target}.png`, fullPage: true });
  console.log(
    `WebView ${target}: inicio y registro accesibles; navegación empaquetada correcta; sin crear cuentas.`,
  );
} finally {
  await browser.close();
}
