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
