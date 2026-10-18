// Registra o service worker (sem cache) que torna o app instalável.
// Só em produção: no dev ele atrapalharia o hot reload.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  })
}
