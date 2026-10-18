import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/theme.scss'
import App from './App.tsx'
import { initNotices } from './lib/initNotices'
import { registerServiceWorker } from './lib/registerServiceWorker'
import { initTheme } from './stores/themeStore'

initTheme()
initNotices()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
