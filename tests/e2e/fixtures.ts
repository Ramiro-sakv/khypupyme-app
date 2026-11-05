import { test as base, expect } from '@playwright/test';
// Segundo cerrojo: aunque se sirviera por error un build local, ningún test
// del navegador puede enviar solicitudes a los servicios de la sesión habitual.
export const test = base.extend({
  context: async ({ context }, use) => {
    const blocked: string[] = [];
    await context.route(/^http:\/\/(127\.0\.0\.1|localhost):(8080|9099|5001)\//, async (route) => {
      blocked.push(new URL(route.request().url()).origin);
      await route.abort('blockedbyclient');
    });
    await use(context);
    expect(blocked, 'La prueba intentó usar los servicios interactivos del propietario').toEqual(
      [],
    );
  },
});
export { expect };
