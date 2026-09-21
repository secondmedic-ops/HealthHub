import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The PWA service worker has been removed — this is an internal tool with
// no offline requirement, and its app-shell caching was causing hard
// refreshes to sometimes show a stale page instead of the latest deploy.
// This unregisters it for anyone whose browser already installed the old
// one; public/sw.js itself now also self-destructs as a second safety net.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

