import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/safari-scroll-guard';

// When a new version deploys, the old hashed chunks disappear from the server.
// A stale client (common on iPads left open / saved to home screen) then fails
// its next lazy import. Vite fires vite:preloadError for this — reload once to
// pick up the fresh index.html and matching chunks instead of showing the
// "Importing binding name ... is not found" error screen.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('chunk-error-reload');
  // Guard against a reload loop if the server itself is unhealthy
  if (!lastReload || Date.now() - Number(lastReload) > 30000) {
    sessionStorage.setItem('chunk-error-reload', String(Date.now()));
    window.location.reload();
  }
});

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
});

createRoot(document.getElementById('root')!).render(<App />);
