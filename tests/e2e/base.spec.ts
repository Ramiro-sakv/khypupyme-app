import { navigate, expectBusinessView } from './navigation';
import { expect, test } from './fixtures';

test('registro, negocio persistente, edición, cierre e inicio de sesión', async ({
  page,
}, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@example.invalid`;
  const password = 'una-frase-de-prueba-segura';
  await page.goto('/negocio');
  await expect(page).toHaveURL(/ingresar/);
  await page.getByRole('link', { name: 'Crear una cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Empecemos con tu negocio' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Dale un nombre a tu negocio' })).toBeVisible();
  await page.getByLabel('Nombre del negocio').fill('Tienda de prueba');
  await page.getByLabel('Tipo de negocio').selectOption('retail');
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Tienda de prueba' })).toBeVisible();
  await page.goto('/negocio');
  await page.reload();
  await expectBusinessView(page, page.getByLabel('Nombre del negocio'));
  await expect(page.getByLabel('Nombre del negocio')).toHaveValue('Tienda de prueba');
  await navigate(page, 'Mi negocio');
  await page.getByLabel('Nombre del negocio').fill('Tienda actualizada');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toHaveText('Tu negocio se guardó correctamente.');
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
  await page.screenshot({ path: `test-results/profile-${info.project.name}.png`, fullPage: true });
  if (!(await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).isVisible()))
    await page.getByRole('button', { name: '☰ Menú' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/ingresar/);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expectBusinessView(page, page.getByRole('heading', { name: 'Hola, Tienda actualizada' }));
});

test('recuperación local con mensaje comprensible', async ({ page }) => {
  await page.goto('/recuperar');
  await page.getByLabel('Correo electrónico').fill('inexistente@example.invalid');
  await page.getByRole('button', { name: 'Solicitar recuperación' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
});

test('bloquea formularios sin conexión y prepara la PWA', async ({ page, context }) => {
  await page.goto('/ingresar');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const manifest = await page.request.get('/manifest.webmanifest');
  expect((await manifest.json()).icons).toHaveLength(2);
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toContainText('Sin conexión');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  await context.setOffline(false);
  await page.goto('/ingresar');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
});
