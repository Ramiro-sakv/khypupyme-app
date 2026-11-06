import { INDUSTRIES } from '../../shared/business-industries';
import type { IndustryId } from '../../shared/business-industries';
import { expect, test } from './fixtures';
import { navigate, expectBusinessView } from './navigation';
import { specifications } from '../fixtures/product-specifications';
test('creación por rubro, seis fichas distintas y venta de cajas calculadas', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto('/registro');
  await page
    .getByLabel('Correo electrónico')
    .fill(`industries-${info.project.name}-${Date.now()}@example.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('una-frase-de-prueba-segura');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await page.getByLabel('Nombre del negocio').fill('Comercio de rubros');
  await page.getByLabel('Tipo de negocio').selectOption('industry:ceramics');
  await expect(page.getByRole('region', { name: 'Vista previa del perfil' })).toContainText(
    'cobertura en m²',
  );
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Comercio de rubros' })).toBeVisible();
  const cases = [
    { industry: 'ceramics', name: 'Piso beta', specification: specifications.ceramic },
    { industry: 'timber', name: 'Tablón beta', specification: specifications.timber },
    { industry: 'footwear', name: 'Zapato beta', specification: specifications.apparel },
    { industry: 'appliances', name: 'Equipo beta', specification: specifications.appliance },
    { industry: 'cement', name: 'Cemento beta', specification: specifications.cement },
    { industry: 'convenience', name: 'Bebida beta', specification: specifications.perishable },
  ];
  for (const [index, item] of cases.entries()) {
    if (index > 0) {
      await navigate(page, 'Mi negocio');
      await page.getByLabel('Tipo de negocio').selectOption(`industry:${item.industry}`);
      await page.getByRole('button', { name: 'Guardar herramientas' }).click();
      await expect(page.locator('.saved-industry')).toContainText(
        INDUSTRIES[item.industry as IndustryId].name,
      );
      await expect(page.getByRole('button', { name: 'Guardar herramientas' })).toBeEnabled();
    }
    await navigate(page, 'Inventario');
    await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
    await expect(page.getByLabel('Ficha del producto')).toHaveValue(item.specification.kind);
    await page.getByLabel('Nombre del producto').fill(item.name);
    await page.getByLabel('Precio de venta (BOB)').fill('40');
    await page.getByLabel('Existencia inicial').fill('10');
    await page.getByLabel('Costo unitario inicial (BOB)').fill('20');
    await page.getByLabel('Unidad de existencias y venta').selectOption(item.specification.unit);
    for (const [key, value] of Object.entries(item.specification.attributes))
      await page.locator(`[name="spec-${key}"]`).fill(String(value));
    await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
    await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible();
  }
  await page.reload();
  await expectBusinessView(page, page.getByRole('list', { name: 'Lista de productos' }));
  await expect(page.getByRole('list', { name: 'Lista de productos' })).toContainText('0,150000 m³');
  await expect(page.getByRole('list', { name: 'Lista de productos' })).toContainText('500,000 kg');
  await navigate(page, 'Ventas');
  await expectBusinessView(page, page.getByRole('button', { name: 'Nueva venta', exact: true }));
  await page.getByRole('button', { name: 'Nueva venta', exact: true }).click();
  const selector = page.getByRole('combobox', { name: 'Producto', exact: true });
  const option = selector.locator('option').filter({ hasText: 'Piso beta' });
  await expect(option).toHaveCount(1);
  await selector.selectOption((await option.getAttribute('value'))!);
  await page.getByText('Calcular cajas para un área', { exact: true }).click();
  await page.getByLabel('Área a cubrir (m²)').fill('10');
  await page.getByRole('button', { name: 'Usar cantidad calculada' }).click();
  await expect(page.getByLabel('Cantidad (cajas)', { exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Agregar a la venta' }).click();
  await page.getByRole('button', { name: 'Revisar venta' }).click();
  await expect(page.getByRole('region', { name: 'Confirmar operación' })).toContainText('8 cajas');
  await expect(page.getByRole('region', { name: 'Confirmar operación' })).toContainText('Tono: A');
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect(page.getByRole('region', { name: 'Detalle de venta' })).toContainText('8 cajas');
  await expect(page.getByRole('region', { name: 'Detalle de venta' })).toContainText('Tono: A');
  await navigate(page, 'Inventario');
  const card = page
    .locator('.product-card')
    .filter({ has: page.getByRole('heading', { name: 'Piso beta', exact: true }) });
  await expect(card).toContainText('2 cajas');
  await expect(card).toContainText('2,8800 m²');
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((element) => element.clientWidth),
  );
  await page.screenshot({
    path: `test-results/industries-${info.project.name}.png`,
    fullPage: true,
  });
  await navigate(page, 'Informes');
  await expect(page.locator('.ranking-list')).toContainText('8 cajas');
  await expect(page.locator('.ranking-list')).toContainText('Tono: A');
});
