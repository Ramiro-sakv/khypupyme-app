// Sin caché de datos, formularios, credenciales ni respuestas de Firebase.
// La instalación PWA no implica operaciones comerciales offline.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · KhypuPyme</title><body><h1>Sin conexión</h1><p>No se pueden registrar operaciones. Recupera la conexión y vuelve a abrir KhypuPyme.</p><a href="/">Volver a intentar</a></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )));
});
