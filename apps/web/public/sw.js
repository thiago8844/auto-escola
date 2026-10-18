// Service worker mínimo, só para o app ser instalável.
// Não intercepta requisições nem guarda nada em cache: o app é 100% online,
// então tudo vai direto à rede e nunca serve versão antiga.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  // Limpa qualquer cache que tenha sido criado por versões anteriores
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})
