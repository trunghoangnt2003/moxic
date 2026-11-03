import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// const originalFetch = window.fetch;
// window.fetch = async (url, options = {}) => {
//   return originalFetch(url, {
//     ...options,
//     credentials: 'include',
//   });
// };
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
