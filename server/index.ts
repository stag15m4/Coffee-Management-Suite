import * as Sentry from '@sentry/node';
import express, { type Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { registerRoutes } from './routes';
import { serveStatic } from './static';
import { createServer } from 'http';
import { WebhookHandlers } from './webhookHandlers';
import { SquareWebhookHandlers } from './squareWebhookHandlers';
import { startSquareSyncScheduler } from './squareSync';
import { startConnecteamSyncScheduler } from './connecteamSync';
import logger from './logger';

const app = express();
app.set('trust proxy', 2); // Trust two proxy layers (Cloudflare → Railway) for correct req.protocol/req.ip

// Security headers
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
              connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.stripe.com'],
              frameSrc: ['https://js.stripe.com', 'https://*.supabase.co'],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
              connectSrc: ["'self'", 'ws:', 'wss:', 'https://*.supabase.co', 'https://api.stripe.com'],
              frameSrc: ['https://js.stripe.com', 'https://*.supabase.co'],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          },
    crossOriginEmbedderPolicy: false, // Allow loading cross-origin resources (Stripe, Supabase)
  })
);

// CORS — restrict origins in production; auto-detect Codespace URL in dev
function buildCorsOrigin(): cors.CorsOptions['origin'] {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  }
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  // In Codespaces, allow the forwarded URL origin
  const codespace = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespace && domain) {
    return [`https://${codespace}-5001.${domain}`, `https://${codespace}-5173.${domain}`];
  }
  // Local dev fallback
  return ['http://localhost:5001', 'http://localhost:5173'];
}
app.use(
  cors({
    origin: buildCorsOrigin() as any,
    credentials: true,
  })
);

// Block TRACE/TRACK HTTP methods (Intuit security requirement)
app.use((req, res, next) => {
  if (req.method === 'TRACE' || req.method === 'TRACK') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  next();
});

// HTTPS redirect in production (Intuit security requirement)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Skip HTTPS redirect for healthcheck (Railway probes over internal HTTP)
    if (req.path === '/api/health') return next();
    if (req.get('x-forwarded-proto') !== 'https') {
      if (process.env.APP_URL) {
        // Use configured APP_URL to avoid host header injection
        return res.redirect(301, `${process.env.APP_URL}${req.originalUrl}`);
      }
      // APP_URL not set in production — log warning, fall back to host header
      log('SECURITY WARNING: APP_URL not set, HTTPS redirect using Host header', 'security');
      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
    next();
  });
}

// Cache-Control: no-store for all API responses (Intuit security requirement —
// prevent caching of sensitive financial/QBO data)
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Gzip compression for responses
app.use(compression());

const httpServer = createServer(app);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = 'express') {
  logger.info({ source }, message);
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature' });
  }

  try {
    const sig = Array.isArray(signature) ? signature[0] : signature;

    if (!Buffer.isBuffer(req.body)) {
      log('STRIPE WEBHOOK ERROR: req.body is not a Buffer', 'stripe');
      return res.status(500).json({ error: 'Webhook processing error' });
    }

    await WebhookHandlers.processWebhook(req.body as Buffer, sig);

    res.status(200).json({ received: true });
  } catch (error: any) {
    log(`Webhook error: ${error.message}`, 'stripe');
    res.status(400).json({ error: 'Webhook processing error' });
  }
});

// Square webhook (must be before express.json() for raw body access)
app.post('/api/square/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-square-hmacsha256-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing Square signature' });
  }

  try {
    const sig = Array.isArray(signature) ? signature[0] : signature;
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

    if (!signatureKey) {
      log('SQUARE_WEBHOOK_SIGNATURE_KEY not configured', 'square');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // APP_URL is required for webhook verification — never derive from Host header
    if (!process.env.APP_URL) {
      log('SECURITY ERROR: APP_URL not set — cannot verify Square webhook signature safely', 'square');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    const notificationUrl = `${process.env.APP_URL}/api/square/webhook`;

    await SquareWebhookHandlers.processWebhook(req.body.toString(), sig, signatureKey, notificationUrl);

    res.status(200).json({ received: true });
  } catch (error: any) {
    log(`Square webhook error: ${error.message}`, 'square');
    res.status(400).json({ error: 'Webhook processing error' });
  }
});

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CSRF protection via Origin/Referer header validation
// Applies to all state-changing methods (POST, PUT, PATCH, DELETE)
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/stripe/webhook', '/api/square/webhook', '/api/health']);

function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // APP_URL is the canonical production origin
  if (process.env.APP_URL) {
    origins.push(new URL(process.env.APP_URL).origin);
  }

  // CORS_ORIGIN may list additional allowed origins
  if (process.env.CORS_ORIGIN) {
    for (const o of process.env.CORS_ORIGIN.split(',')) {
      const trimmed = o.trim();
      if (trimmed) {
        try {
          origins.push(new URL(trimmed).origin);
        } catch {
          origins.push(trimmed);
        }
      }
    }
  }

  // In development, allow localhost and Codespace origins
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5001', 'http://localhost:5173', 'http://localhost:5000');
    const codespace = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (codespace && domain) {
      origins.push(`https://${codespace}-5001.${domain}`);
      origins.push(`https://${codespace}-5173.${domain}`);
    }
  }

  return origins;
}

function extractOriginFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip safe (read-only) methods
  if (CSRF_SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Skip exempt paths (webhooks use their own signature verification)
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // Service-token (Alfred) requests authenticate via a secret custom header,
  // not cookies, so they are not CSRF-vulnerable: a cross-site browser request
  // cannot set a custom header without a CORS preflight, nor know the token.
  // The endpoint still verifies the token itself (getApiAuth).
  if (req.headers['x-alfred-token'] !== undefined) {
    return next();
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;
  const requestOrigin = origin || (referer ? extractOriginFromReferer(referer) : null);

  // If neither Origin nor Referer is present, reject the request
  // (legitimate browser requests always send at least one of these on state-changing methods)
  if (!requestOrigin) {
    log(`CSRF blocked: no Origin/Referer header on ${req.method} ${req.path}`, 'security');
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  const allowed = getAllowedOrigins();

  // If no origins are configured (misconfiguration), block in production, allow in dev
  if (allowed.length === 0 && process.env.NODE_ENV === 'production') {
    log(`CSRF blocked: no allowed origins configured for ${req.method} ${req.path}`, 'security');
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  // In dev with no configured origins, allow any localhost origin
  if (allowed.length === 0 && process.env.NODE_ENV !== 'production') {
    if (requestOrigin.startsWith('http://localhost') || requestOrigin.startsWith('https://localhost')) {
      return next();
    }
  }

  if (allowed.includes(requestOrigin)) {
    return next();
  }

  log(
    `CSRF blocked: origin "${requestOrigin}" not in allowed list [${allowed.join(', ')}] on ${req.method} ${req.path}`,
    'security'
  );
  return res.status(403).json({ error: 'CSRF validation failed' });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Only log response body in development, and truncate to avoid leaking sensitive data
      if (capturedJsonResponse && process.env.NODE_ENV !== 'production') {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 200 ? body.slice(0, 200) + '...' : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Only expose error details for client errors; mask server errors
    const message = status < 500 ? err.message || 'Internal Server Error' : 'Internal Server Error';
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    logger.error({ err }, 'Unhandled Express error');
  });

  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  } else {
    const { setupVite } = await import('./vite');
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  httpServer.listen(
    {
      port,
      host: '0.0.0.0',
    },
    () => {
      log(`serving on port ${port}`);
      startSquareSyncScheduler();
      startConnecteamSyncScheduler();
    }
  );
})();
