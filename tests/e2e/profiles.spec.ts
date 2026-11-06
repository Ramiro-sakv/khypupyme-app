import { expect, test } from './fixtures';
import { navigate } from './navigation';
// Esta prueba intercepta archivos del build; el service worker se verifica
// por separado en base.spec.ts y no debe ocultar aquí el fallo de red simulado.
test.use({ serviceWorkers: 'block' });

test('perfil de servicios combina herramientas, conserva productos y recupera una pantalla fallida', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const inventoryRequests: string[] = [];
  page.context().on('request', (request) => {
    if (/\/InventoryPage-[^/]+\.js/.test(request.url())) inventoryRequests.push(request.url());
  });
  await page.goto('/registro');
  await page
    .getByLabel('Correo electrónico')
    .fill(`profiles-${info.project.name}-${Date.now()}@example.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('una-frase-de-prueba-segura');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await page.getByLabel('Nombre del negocio').fill('Taller modular');
  await page.getByLabel('Tipo de negocio').selectOption('services');
  await expect(page.getByRole('region', { name: 'Vista previa del perfil' })).toContainText(
    'costos directos',
  );
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Taller modular' })).toBeVisible();
  expect(inventoryRequests).toHaveLength(0);
  await expect(page.locator('nav a[href="/inventario"]')).toHaveCount(0);
  await page.goto('/inventario');
  await expect(
    page.getByRole('heading', { name: 'Esta herramienta está desactivada' }),
  ).toBeVisible();
  expect(inventoryRequests).toHaveLength(0);
  await page.getByRole('link', { name: 'Configurar herramientas' }).click();
  await page.getByLabel('Compras', { exact: true }).check();
  await expect(page.getByLabel('Inventario', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Guardar herramientas' }).click();
  await expect(page.getByRole('button', { name: 'Guardar herramientas' })).toBeEnabled();
  // La navegación se actualiza desde el perfil confirmado por el servidor.
  await expect(page.locator('nav a[href="/inventario"]')).toHaveCount(1);
  let unavailable = true;
  await page.route('**/InventoryPage-*.js', (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          contentType: 'text/javascript',
          headers: { 'Cache-Control': 'no-store' },
          body: '/* temporalmente no disponible */',
        })
      : route.continue(),
  );
  await navigate(page, 'Inventario');
  await expect(
    page.getByRole('heading', { name: 'No pudimos abrir esta herramienta' }),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Volver a cargar' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo producto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  await page.getByLabel('Nombre del producto').fill('Pieza conservada');
  await page.getByLabel('Precio de venta (BOB)').fill('10');
  await page.getByLabel('Existencia inicial').fill('10');
  await page.getByLabel('Costo unitario inicial (BOB)').fill('5');
  await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pieza conservada' })).toBeVisible();
  await navigate(page, 'Mi negocio');
  await page.getByLabel('Tipo de negocio').selectOption('services');
  await page.getByRole('button', { name: 'Guardar herramientas' }).click();
  await expect(page.locator('nav a[href="/inventario"]')).toHaveCount(0);
  await navigate(page, 'Inicio');
  await expect(page.locator('.inventory-summary')).toContainText('50,00');
  await expect(page.getByRole('link', { name: 'Activar inventario conservado' })).toBeVisible();
  await navigate(page, 'Mi negocio');
  await page.getByLabel('Compras', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar herramientas' }).click();
  await expect(page.locator('nav a[href="/inventario"]')).toHaveCount(1);
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((element) => element.clientWidth),
  );
  await page.screenshot({ path: `test-results/profiles-${info.project.name}.png`, fullPage: true });
  await navigate(page, 'Inventario');
  const product = page.getByRole('list', { name: 'Lista de productos' });
  await expect(product).toContainText('Pieza conservada');
  await expect(product).toContainText('10 unidades');
  await expect(product).toContainText('50,00');
  expect(inventoryRequests.length).toBeGreaterThanOrEqual(2);
});
