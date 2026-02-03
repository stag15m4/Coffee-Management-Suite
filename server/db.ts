import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Allow running without database in development for UI testing
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  } else {
    console.warn('[DB] DATABASE_URL not set - running in mock data mode for UI testing');
  }
}

// Create pool only if DATABASE_URL exists
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null as any;
