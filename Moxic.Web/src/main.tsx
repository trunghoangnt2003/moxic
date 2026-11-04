import './lib/i18n' // first: sets the language (from the URL) and Accept-Language before any API client is created
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerServiceWorker } from './lib/pwa'
import { installNavPendingTracker } from './lib/navPending'

registerServiceWorker()
// The app shell can come from the service-worker cache; if it is older than the deployed build, a lazy page
// chunk may be gone. Reload once to pick up the fresh shell instead of showing a broken page.
window.addEventListener("vite:preloadError", (e) => {
  try {
    if (sessionStorage.getItem("moxic.chunkReload")) return
    sessionStorage.setItem("moxic.chunkReload", "1")
  } catch {
    /* storage unavailable: still reload once */
  }
  e.preventDefault()
  window.location.reload()
})
window.addEventListener("load", () => {
  try { setTimeout(() => sessionStorage.removeItem("moxic.chunkReload"), 10000) } catch { /* ignore */ }
})
// Must run before the router creates its history so page changes can show the loading wave.
installNavPendingTracker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
