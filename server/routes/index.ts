import type { Express } from 'express';
import { registerStaffAccessRoutes } from './staff-access';
import { registerAdminRoutes } from './admin';
import { registerKioskRoutes } from './kiosk';
import { registerBillingRoutes } from './billing';
import { registerResellerRoutes } from './reseller';
import { registerTipRoutes } from './tips';
import { registerAlfredRoutes } from './alfred';
import { registerConnecteamRoutes } from './connecteam';
import { registerAuthBootstrapRoutes } from './auth-bootstrap';
import { registerTimeClockRoutes } from './time-clock';

/**
 * Register all route sub-modules on the Express app.
 * Called from the main registerRoutes() in server/routes.ts.
 */
export async function registerAllRouteModules(app: Express): Promise<void> {
  // Synchronous registrations
  registerAdminRoutes(app);
  registerStaffAccessRoutes(app);
  registerKioskRoutes(app);
  registerTipRoutes(app);
  registerAlfredRoutes(app);
  registerConnecteamRoutes(app);
  registerAuthBootstrapRoutes(app);
  registerTimeClockRoutes(app);

  // Async registrations (dynamic imports for Stripe/reseller services)
  await registerBillingRoutes(app);
  await registerResellerRoutes(app);
}
