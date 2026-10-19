// Versioned, additive migration 163. Railway runs this before replacing the
// healthy app; a failed migration blocks deployment and leaves the old app live.
const { Client } = require('pg');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout='20s'; SET statement_timeout='60s'");
    await client.query('SELECT pg_advisory_lock(163, 163)');
    await client.query(readFileSync(join(__dirname, '../supabase-migrations/163_compliance_delegation.sql'), 'utf8'));
    console.log('Compliance migration 163 applied successfully.');
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    'Compliance migration 163 failed; deployment stopped. Check database connectivity, permissions, and migration prerequisites.'
  );
  process.exitCode = 1;
});
