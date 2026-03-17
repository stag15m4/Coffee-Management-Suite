import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/safari-scroll-guard';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
});

createRoot(document.getElementById('root')!).render(<App />);
