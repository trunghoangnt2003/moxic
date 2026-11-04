import './lib/i18n' // first: sets the language (from the URL) and Accept-Language before any API client is created
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerServiceWorker } from './lib/pwa'
import { installNavPendingTracker } from './lib/navPending'

registerServiceWorker()
// Must run before the router creates its history so page changes can show the loading wave.
installNavPendingTracker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
