import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
export async function navigate(page: Page, label: string) {
  const link = page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: label, exact: true });
  if (!(await link.isVisible())) await page.getByRole('button', { name: '☰ Menú' }).click();
  await link.click();
}

export async function expectBusinessView(page: Page, view: Locator) {
  const retry = page.getByRole('button', { name: 'Volver a consultar', exact: true });
  // Ejercita la recuperación manual disponible cuando el canal de lectura aún no está listo.
  await expect(view.or(retry)).toBeVisible({ timeout: 20000 });
  if (await retry.isVisible()) await retry.click();
  await expect(view).toBeVisible({ timeout: 20000 });
}
