import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getUserIdFromRequest, kioskVerifyRateLimit, enforceMapLimit } from './core';

// ── In-Memory State ─────────────────────────────────────────

// Kiosk session tokens — issued after PIN verification, required for all actions
const kioskSessions = new Map<string, { tenantId: string; employeeId: string; expiresAt: number }>();
const KIOSK_SESSION_TTL = 15 * 60 * 1000; // 15 minutes

function verifyKioskSession(token: string | undefined, tenantId: string, employeeId: string): boolean {
  if (!token) return false;
  const session = kioskSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    kioskSessions.delete(token);
    return false;
  }
  return session.tenantId === tenantId && session.employeeId === employeeId;
}

// Rate limiting for PIN attempts (per-IP)
const kioskRateLimit = new Map<string, { count: number; resetTime: number }>();
function checkKioskRate(ip: string): boolean {
  const now = Date.now();
  const entry = kioskRateLimit.get(ip);
  if (!entry || now >= entry.resetTime) {
    kioskRateLimit.set(ip, { count: 1, resetTime: now + 60_000 });
    enforceMapLimit(kioskRateLimit, 10_000);
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// Per-user PIN lockout: 5 failed attempts -> 15-minute lockout
const pinLockout = new Map<string, { attempts: number; lockedUntil: Date }>();
const PIN_LOCKOUT_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkPinLockout(userId: string): { locked: boolean; remainingMs?: number } {
  const entry = pinLockout.get(userId);
  if (!entry) return { locked: false };
  const now = new Date();
  if (now >= entry.lockedUntil) {
    pinLockout.delete(userId);
    return { locked: false };
  }
  if (entry.attempts >= PIN_LOCKOUT_MAX_ATTEMPTS) {
    return { locked: true, remainingMs: entry.lockedUntil.getTime() - now.getTime() };
  }
  return { locked: false };
}

function recordFailedPinAttempt(userId: string): void {
  const entry = pinLockout.get(userId);
  if (!entry) {
    pinLockout.set(userId, { attempts: 1, lockedUntil: new Date(Date.now() + PIN_LOCKOUT_DURATION_MS) });
    enforceMapLimit(pinLockout, 10_000);
    return;
  }
  entry.attempts++;
  if (entry.attempts >= PIN_LOCKOUT_MAX_ATTEMPTS) {
    entry.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION_MS);
  }
}

function clearPinLockout(userId: string): void {
  pinLockout.delete(userId);
}

// Export these maps so the periodic cleanup in routes.ts can access them
export { kioskSessions, kioskRateLimit, pinLockout };

export function registerKioskRoutes(app: Express): void {
  // Periodic cleanup of expired kiosk sessions and rate limit entries
  setInterval(
    () => {
      const now = Date.now();
      kioskSessions.forEach((session, key) => {
        if (now > session.expiresAt) kioskSessions.delete(key);
      });
      kioskRateLimit.forEach((entry, key) => {
        if (now >= entry.resetTime) kioskRateLimit.delete(key);
      });
      const nowDate = new Date();
      pinLockout.forEach((entry, key) => {
        if (nowDate >= entry.lockedUntil) pinLockout.delete(key);
      });
    },
    5 * 60 * 1000
  ); // every 5 minutes

  // POST /api/kiosk/verify — validate store code, return tenant info
  app.post('/api/kiosk/verify', kioskVerifyRateLimit, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Store code is required' });
      }
      const result = await db.execute(sql`
        SELECT t.id, t.name, tb.logo_url
        FROM tenants t
        LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
        WHERE UPPER(t.kiosk_code) = UPPER(${code.trim()})
        LIMIT 1
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Store not found' });
      }
      const row = result.rows[0] as any;
      res.json({ tenantId: row.id, tenantName: row.name, logoUrl: row.logo_url || null });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/kiosk/punch — look up employee by PIN, return clock status
  app.post('/api/kiosk/punch', async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkKioskRate(ip)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
      }
      const { tenantId, pin } = req.body;
      if (!tenantId || !pin) {
        return res.status(400).json({ error: 'Missing tenantId or pin' });
      }

      // Check per-IP+tenant lockout (5 failed attempts -> 15-minute lockout)
      const lockoutKey = `${ip}:${tenantId}`;
      const earlyLockout = checkPinLockout(lockoutKey);
      if (earlyLockout.locked) {
        const mins = Math.ceil((earlyLockout.remainingMs || 0) / 60_000);
        return res
          .status(429)
          .json({ error: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` });
      }

      // Look up in user_profiles first, then tip_employees
      // Supports both bcrypt-hashed and legacy plaintext PINs during migration
      let emp: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
        role: string;
        source: 'user_profile' | 'tip_employee';
      } | null = null;
      let needsHashUpgrade = false;
      let upgradeTable: 'user_profiles' | 'tip_employees' | null = null;

      // Fetch all active employees with PINs for this tenant (small set per coffee shop)
      const upResult = await db.execute(sql`
        SELECT id, full_name, avatar_url, role, kiosk_pin
        FROM user_profiles
        WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin IS NOT NULL AND is_active = true
      `);
      for (const r of upResult.rows as any[]) {
        // Check per-user lockout before comparing
        const lockout = checkPinLockout(r.id);
        if (lockout.locked) continue;

        const storedPin: string = r.kiosk_pin;
        let match = false;
        if (storedPin.startsWith('$2b$')) {
          // Bcrypt-hashed PIN
          match = await bcrypt.compare(pin, storedPin);
        } else {
          // Legacy plaintext PIN — compare directly, flag for upgrade
          match = storedPin === pin;
          if (match) {
            needsHashUpgrade = true;
            upgradeTable = 'user_profiles';
          }
        }
        if (match) {
          emp = { id: r.id, fullName: r.full_name, avatarUrl: r.avatar_url, role: r.role, source: 'user_profile' };
          break;
        }
      }

      if (!emp) {
        const teResult = await db.execute(sql`
          SELECT id, name, avatar_url, kiosk_pin
          FROM tip_employees
          WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin IS NOT NULL AND is_active = true
        `);
        for (const r of teResult.rows as any[]) {
          const lockout = checkPinLockout(r.id);
          if (lockout.locked) continue;

          const storedPin: string = r.kiosk_pin;
          let match = false;
          if (storedPin.startsWith('$2b$')) {
            match = await bcrypt.compare(pin, storedPin);
          } else {
            match = storedPin === pin;
            if (match) {
              needsHashUpgrade = true;
              upgradeTable = 'tip_employees';
            }
          }
          if (match) {
            emp = {
              id: r.id,
              fullName: r.name,
              avatarUrl: r.avatar_url || null,
              role: 'employee',
              source: 'tip_employee',
            };
            break;
          }
        }
      }

      if (!emp) {
        // Record failed attempt keyed by IP+tenantId to throttle brute-force against a specific store
        recordFailedPinAttempt(lockoutKey);
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Successful PIN verification — clear any prior lockout for this IP+tenant
      clearPinLockout(lockoutKey);

      // Upgrade legacy plaintext PIN to bcrypt hash in background
      if (needsHashUpgrade && upgradeTable) {
        const hashedPin = await bcrypt.hash(pin, 10);
        if (upgradeTable === 'user_profiles') {
          db.execute(
            sql`
            UPDATE user_profiles SET kiosk_pin = ${hashedPin}, updated_at = NOW()
            WHERE id = ${emp.id}::uuid AND tenant_id = ${tenantId}::uuid
          `
          ).catch(() => {}); // non-blocking upgrade
        } else {
          db.execute(
            sql`
            UPDATE tip_employees SET kiosk_pin = ${hashedPin}, updated_at = NOW()
            WHERE id = ${emp.id}::uuid AND tenant_id = ${tenantId}::uuid
          `
          ).catch(() => {}); // non-blocking upgrade
        }
      }

      // Check for active clock entry (could be under employee_id or tip_employee_id)
      const entryResult =
        emp.source === 'user_profile'
          ? await db.execute(sql`
            SELECT tce.id, tce.clock_in,
                   tcb.id AS break_id, tcb.break_start
            FROM time_clock_entries tce
            LEFT JOIN time_clock_breaks tcb
              ON tcb.time_clock_entry_id = tce.id AND tcb.break_end IS NULL
            WHERE tce.employee_id = ${emp.id}::uuid
              AND tce.tenant_id = ${tenantId}::uuid
              AND tce.clock_out IS NULL
            ORDER BY tce.clock_in DESC
            LIMIT 1
          `)
          : await db.execute(sql`
            SELECT tce.id, tce.clock_in,
                   tcb.id AS break_id, tcb.break_start
            FROM time_clock_entries tce
            LEFT JOIN time_clock_breaks tcb
              ON tcb.time_clock_entry_id = tce.id AND tcb.break_end IS NULL
            WHERE tce.tip_employee_id = ${emp.id}::uuid
              AND tce.tenant_id = ${tenantId}::uuid
              AND tce.clock_out IS NULL
            ORDER BY tce.clock_in DESC
            LIMIT 1
          `);

      let status: 'clocked_out' | 'clocked_in' | 'on_break' = 'clocked_out';
      let activeEntryId: string | null = null;
      let clockInTime: string | null = null;
      let activeBreakId: string | null = null;
      let breakStartTime: string | null = null;

      if (entryResult.rows.length > 0) {
        const row = entryResult.rows[0] as any;
        activeEntryId = row.id;
        clockInTime = row.clock_in;
        if (row.break_id) {
          status = 'on_break';
          activeBreakId = row.break_id;
          breakStartTime = row.break_start;
        } else {
          status = 'clocked_in';
        }
      }

      // Issue a kiosk session token after successful PIN verification
      const kioskToken = crypto.randomBytes(32).toString('hex');
      kioskSessions.set(kioskToken, {
        tenantId,
        employeeId: emp.id,
        expiresAt: Date.now() + KIOSK_SESSION_TTL,
      });
      enforceMapLimit(kioskSessions, 50_000);

      res.json({
        employee: { id: emp.id, fullName: emp.fullName, avatarUrl: emp.avatarUrl, role: emp.role, source: emp.source },
        status,
        activeEntryId,
        clockInTime,
        activeBreakId,
        breakStartTime,
        kioskToken,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/kiosk/clock-in
  app.post('/api/kiosk/clock-in', async (req, res) => {
    try {
      const { tenantId, employeeId, source, employeeName, kioskToken } = req.body;
      if (!tenantId || !employeeId) {
        return res.status(400).json({ error: 'Missing tenantId or employeeId' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      const isTipEmployee = source === 'tip_employee';

      // Verify employee belongs to tenant
      const empCheck = isTipEmployee
        ? await db.execute(
            sql`SELECT name FROM tip_employees WHERE id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true LIMIT 1`
          )
        : await db.execute(
            sql`SELECT full_name as name FROM user_profiles WHERE id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true LIMIT 1`
          );
      if (empCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid employee' });
      }
      const name = employeeName || (empCheck.rows[0] as any).name;

      // Verify not already clocked in
      const openCheck = await db.execute(
        isTipEmployee
          ? sql`SELECT 1 FROM time_clock_entries WHERE tip_employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND clock_out IS NULL LIMIT 1`
          : sql`SELECT 1 FROM time_clock_entries WHERE employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND clock_out IS NULL LIMIT 1`
      );
      if (openCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Already clocked in' });
      }

      const result = isTipEmployee
        ? await db.execute(sql`
            INSERT INTO time_clock_entries (tenant_id, tip_employee_id, employee_name, clock_in)
            VALUES (${tenantId}::uuid, ${employeeId}::uuid, ${name}, NOW())
            RETURNING id, clock_in
          `)
        : await db.execute(sql`
            INSERT INTO time_clock_entries (tenant_id, employee_id, employee_name, clock_in)
            VALUES (${tenantId}::uuid, ${employeeId}::uuid, ${name}, NOW())
            RETURNING id, clock_in
          `);
      const row = result.rows[0] as any;
      res.json({ success: true, entryId: row.id, clockIn: row.clock_in });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clock in' });
    }
  });

  // POST /api/kiosk/clock-out
  app.post('/api/kiosk/clock-out', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId, kioskToken } = req.body;
      if (!tenantId || !employeeId || !entryId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      // End any active breaks and clock out atomically
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE time_clock_breaks
          SET break_end = NOW()
          WHERE time_clock_entry_id = ${entryId}::uuid AND break_end IS NULL
        `);
        const clockOutResult = await tx.execute(sql`
          UPDATE time_clock_entries
          SET clock_out = NOW(), updated_at = NOW()
          WHERE id = ${entryId}::uuid AND (employee_id = ${employeeId}::uuid OR tip_employee_id = ${employeeId}::uuid) AND tenant_id = ${tenantId}::uuid
          RETURNING clock_out
        `);
        if (clockOutResult.rows.length === 0) {
          throw new Error('ENTRY_NOT_FOUND');
        }
        return clockOutResult.rows[0] as any;
      });
      res.json({ success: true, clockOut: result.clock_out });
    } catch (err: any) {
      if (err?.message === 'ENTRY_NOT_FOUND') {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.status(500).json({ error: 'Failed to clock out' });
    }
  });

  // POST /api/kiosk/break-start
  app.post('/api/kiosk/break-start', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId, kioskToken } = req.body;
      if (!tenantId || !employeeId || !entryId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      // Verify entry belongs to this employee and tenant
      const entryCheck = await db.execute(sql`
        SELECT 1 FROM time_clock_entries
        WHERE id = ${entryId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND (employee_id = ${employeeId}::uuid OR tip_employee_id = ${employeeId}::uuid)
        AND clock_out IS NULL
        LIMIT 1
      `);
      if (entryCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Entry not found' });
      }
      // Verify no active break
      const activeBreak = await db.execute(sql`
        SELECT 1 FROM time_clock_breaks
        WHERE time_clock_entry_id = ${entryId}::uuid AND break_end IS NULL
        LIMIT 1
      `);
      if (activeBreak.rows.length > 0) {
        return res.status(409).json({ error: 'Already on break' });
      }
      const result = await db.execute(sql`
        INSERT INTO time_clock_breaks (tenant_id, time_clock_entry_id, break_start, break_type)
        VALUES (${tenantId}::uuid, ${entryId}::uuid, NOW(), 'break')
        RETURNING id, break_start
      `);
      const row = result.rows[0] as any;
      res.json({ success: true, breakId: row.id, breakStart: row.break_start });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to start break' });
    }
  });

  // POST /api/kiosk/break-end
  app.post('/api/kiosk/break-end', async (req, res) => {
    try {
      const { tenantId, breakId, employeeId, kioskToken } = req.body;
      if (!tenantId || !breakId || !employeeId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      // Verify break belongs to an entry owned by this employee
      const breakCheck = await db.execute(sql`
        SELECT 1 FROM time_clock_breaks tcb
        JOIN time_clock_entries tce ON tcb.time_clock_entry_id = tce.id
        WHERE tcb.id = ${breakId}::uuid
        AND tcb.tenant_id = ${tenantId}::uuid
        AND (tce.employee_id = ${employeeId}::uuid OR tce.tip_employee_id = ${employeeId}::uuid)
        AND tcb.break_end IS NULL
        LIMIT 1
      `);
      if (breakCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Break not found' });
      }
      const result = await db.execute(sql`
        UPDATE time_clock_breaks
        SET break_end = NOW()
        WHERE id = ${breakId}::uuid AND tenant_id = ${tenantId}::uuid AND break_end IS NULL
        RETURNING break_end
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Break not found' });
      }
      const row = result.rows[0] as any;
      res.json({ success: true, breakEnd: row.break_end });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to end break' });
    }
  });

  // GET /api/kiosk/my-hours — employee's time entries for a date range
  app.get('/api/kiosk/my-hours', async (req, res) => {
    try {
      const { tenantId, employeeId, source, start, end, kioskToken } = req.query as Record<string, string>;
      if (!tenantId || !employeeId || !start || !end) {
        return res.status(400).json({ error: 'Missing required query params' });
      }
      const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD');
      const startParse = dateSchema.safeParse(start);
      const endParse = dateSchema.safeParse(end);
      if (!startParse.success || !endParse.success) {
        return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      const isTip = source === 'tip_employee';
      const result = await db.execute(
        isTip
          ? sql`
              SELECT tce.id, tce.clock_in, tce.clock_out, tce.notes,
                     COALESCE(
                       json_agg(
                         json_build_object('id', tcb.id, 'break_start', tcb.break_start, 'break_end', tcb.break_end)
                       ) FILTER (WHERE tcb.id IS NOT NULL),
                       '[]'
                     ) AS breaks,
                     CASE WHEN EXISTS (
                       SELECT 1 FROM time_clock_edit_requests tcer
                       WHERE tcer.entry_id = tce.id AND tcer.status = 'pending'
                     ) THEN true ELSE false END AS has_pending_edit
              FROM time_clock_entries tce
              LEFT JOIN time_clock_breaks tcb ON tcb.time_clock_entry_id = tce.id
              WHERE tce.tip_employee_id = ${employeeId}::uuid
                AND tce.tenant_id = ${tenantId}::uuid
                AND tce.clock_in >= ${start}::date
                AND tce.clock_in < (${end}::date + INTERVAL '1 day')
              GROUP BY tce.id
              ORDER BY tce.clock_in ASC
            `
          : sql`
              SELECT tce.id, tce.clock_in, tce.clock_out, tce.notes,
                     COALESCE(
                       json_agg(
                         json_build_object('id', tcb.id, 'break_start', tcb.break_start, 'break_end', tcb.break_end)
                       ) FILTER (WHERE tcb.id IS NOT NULL),
                       '[]'
                     ) AS breaks,
                     CASE WHEN EXISTS (
                       SELECT 1 FROM time_clock_edit_requests tcer
                       WHERE tcer.entry_id = tce.id AND tcer.status = 'pending'
                     ) THEN true ELSE false END AS has_pending_edit
              FROM time_clock_entries tce
              LEFT JOIN time_clock_breaks tcb ON tcb.time_clock_entry_id = tce.id
              WHERE tce.employee_id = ${employeeId}::uuid
                AND tce.tenant_id = ${tenantId}::uuid
                AND tce.clock_in >= ${start}::date
                AND tce.clock_in < (${end}::date + INTERVAL '1 day')
              GROUP BY tce.id
              ORDER BY tce.clock_in ASC
            `
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch hours' });
    }
  });

  // POST /api/kiosk/edit-request — submit a time clock edit request
  app.post('/api/kiosk/edit-request', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId, correctedClockIn, correctedClockOut, reason, kioskToken } = req.body;
      if (!tenantId || !employeeId || !entryId || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!verifyKioskSession(kioskToken, tenantId, employeeId)) {
        return res.status(401).json({ error: 'Invalid or expired kiosk session' });
      }
      // Verify entry belongs to employee
      const entryCheck = await db.execute(sql`
        SELECT 1 FROM time_clock_entries
        WHERE id = ${entryId}::uuid AND employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);
      if (entryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const result = await db.execute(sql`
        INSERT INTO time_clock_edit_requests (tenant_id, entry_id, requested_by, corrected_clock_in, corrected_clock_out, reason, status)
        VALUES (${tenantId}::uuid, ${entryId}::uuid, ${employeeId}::uuid,
                ${correctedClockIn || null}::timestamptz, ${correctedClockOut || null}::timestamptz,
                ${reason}, 'pending')
        RETURNING id
      `);
      const row = result.rows[0] as any;
      res.json({ success: true, requestId: row.id });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to submit edit request' });
    }
  });

  // POST /api/kiosk/update-pin — manager/owner updates employee PIN (requires auth)
  app.post('/api/kiosk/update-pin', async (req, res) => {
    try {
      // Authenticate via JWT — only managers/owners can update PINs
      const { userId: authUserId } = await getUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { userId: targetUserId, tenantId, newPin } = req.body;
      if (!targetUserId || !tenantId || !newPin) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify requester is manager/owner of this tenant
      const requesterResult = await db.execute(sql`
        SELECT role FROM user_profiles
        WHERE id = ${authUserId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requester = requesterResult.rows[0] as any;
      if (!requester || !['owner', 'manager'].includes(requester.role)) {
        return res.status(403).json({ error: 'Only owners and managers can update PINs' });
      }

      if (!/^\d{4}$/.test(newPin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      // Check uniqueness within tenant — must compare against both hashed and legacy plaintext PINs
      const existingPins = await db.execute(sql`
        SELECT id, kiosk_pin FROM user_profiles
        WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin IS NOT NULL AND is_active = true AND id != ${targetUserId}::uuid
      `);
      for (const row of existingPins.rows as any[]) {
        const storedPin: string = row.kiosk_pin;
        let isDuplicate = false;
        if (storedPin.startsWith('$2b$')) {
          isDuplicate = await bcrypt.compare(newPin, storedPin);
        } else {
          isDuplicate = storedPin === newPin;
        }
        if (isDuplicate) {
          return res.status(409).json({ error: 'PIN already in use by another employee' });
        }
      }
      // Hash the PIN before storing
      const hashedPin = await bcrypt.hash(newPin, 10);
      await db.execute(sql`
        UPDATE user_profiles SET kiosk_pin = ${hashedPin}, updated_at = NOW()
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${tenantId}::uuid
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update PIN' });
    }
  });

  // POST /api/kiosk/set-code — owner sets kiosk store code (requires auth)
  app.post('/api/kiosk/set-code', async (req, res) => {
    try {
      // Authenticate via JWT — only owners can set kiosk code
      const { userId: authUserId } = await getUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { tenantId, kioskCode } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'Missing tenantId' });
      }

      // Verify requester is owner of this tenant
      const requesterResult = await db.execute(sql`
        SELECT role FROM user_profiles
        WHERE id = ${authUserId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requester = requesterResult.rows[0] as any;
      if (!requester || requester.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can set the kiosk code' });
      }

      const code = (kioskCode || '').trim().toUpperCase();
      if (code && (code.length < 2 || code.length > 10 || !/^[A-Z0-9]+$/.test(code))) {
        return res.status(400).json({ error: 'Code must be 2-10 alphanumeric characters' });
      }
      // Check uniqueness
      if (code) {
        const dupCheck = await db.execute(sql`
          SELECT 1 FROM tenants WHERE UPPER(kiosk_code) = ${code} AND id != ${tenantId}::uuid
          LIMIT 1
        `);
        if (dupCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Code already in use by another store' });
        }
      }
      await db.execute(sql`
        UPDATE tenants SET kiosk_code = ${code || null} WHERE id = ${tenantId}::uuid
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to set kiosk code' });
    }
  });
}
