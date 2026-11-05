import { expect, test } from './fixtures';
import { navigate } from './navigation';
test('beta: servicio, venta fiada, cobro, gasto, informe y anulación', async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  await page.goto('/registro');
  await page
    .getByLabel('Correo electrónico')
    .fill(`commerce-${info.project.name}-${Date.now()}@example.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('una-frase-de-prueba-segura');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await page.getByLabel('Nombre del negocio').fill('Estudio beta');
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Estudio beta' })).toBeVisible();
  await navigate(page, 'Servicios');
  await page.getByRole('button', { name: 'Registrar servicio', exact: true }).click();
  await page.getByLabel('Nombre del servicio').fill('Diseño de prueba');
  await page.getByLabel('Precio (BOB)', { exact: true }).fill('100');
  await page.getByLabel('Costo directo unitario (BOB)').fill('20');
  await page.getByRole('button', { name: 'Revisar registro' }).click();
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Diseño de prueba' })).toBeVisible();
  await navigate(page, 'Ventas');
  await page.getByRole('button', { name: 'Nueva venta', exact: true }).click();
  await page.getByLabel('Tipo de artículo').selectOption('service');
  await page
    .getByRole('combobox', { name: 'Servicio del catálogo' })
    .selectOption({ label: 'Diseño de prueba' });
  await page.getByRole('button', { name: 'Agregar a la venta' }).click();
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Ana ficticia');
  await page.getByLabel('Forma de pago').selectOption('credit');
  await page.getByRole('button', { name: 'Revisar venta' }).click();
  await expect(page.getByRole('region', { name: 'Confirmar operación' })).toContainText('100,00');
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.getByRole('region', { name: 'Detalle de venta' })).toContainText(
    'Diseño de prueba',
  );
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();
  await navigate(page, 'Fiados y cobros');
  await expect(page.getByRole('heading', { name: 'Ana ficticia' })).toBeVisible();
  await page.getByRole('button', { name: 'Cobrar completo' }).click();
  await page.getByLabel('Forma de pago').selectOption('qr');
  await page.getByRole('button', { name: 'Revisar operación' }).click();
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.locator('.records-list')).toContainText('Cobrado');
  await navigate(page, 'Gastos');
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  await page.getByLabel('Importe (BOB)').fill('10');
  await page.getByLabel('Descripción', { exact: true }).fill('Transporte de prueba');
  await page.getByRole('button', { name: 'Revisar registro' }).click();
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Transporte de prueba' })).toBeVisible();
  await navigate(page, 'Informes');
  await expect(page.locator('.metric-grid')).toContainText('70,00');
  await expect(page.getByRole('img', { name: /Ventas y gastos diarios/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/khypupyme.*csv/);
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
  await page.screenshot({
    path: `test-results/beta-report-${info.project.name}.png`,
    fullPage: true,
  });
  await navigate(page, 'Ventas');
  await page.getByRole('button', { name: 'Anular', exact: true }).click();
  await page.getByLabel('Motivo de anulación').fill('Venta de prueba equivocada');
  await page.getByRole('button', { name: 'Revisar operación' }).click();
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.locator('.records-list')).toContainText('Anulado');
  await navigate(page, 'Clientes');
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Registrar cliente', exact: true })).toBeDisabled();
  await context.setOffline(false);
});
