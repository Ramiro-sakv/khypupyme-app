import type { Page } from '@playwright/test';
export async function navigate(page: Page, label: string) {
  const link = page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: label, exact: true });
  if (!(await link.isVisible())) await page.getByRole('button', { name: '☰ Menú' }).click();
  await link.click();
}
