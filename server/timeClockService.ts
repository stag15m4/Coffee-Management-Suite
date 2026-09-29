import { sql } from 'drizzle-orm';
import { db } from './db';

export class ClockEntryNotOpenError extends Error {
  constructor() {
    super('Clock entry is not open for this employee');
  }
}

/** Close a shift and any active breaks at the same database timestamp. */
export async function closeClockEntry(
  tenantId: string,
  employeeId: string,
  entryId: string,
  allowTipEmployee = false,
  notes?: string
) {
  return db.transaction(async (tx) => {
    const employeePredicate = allowTipEmployee
      ? sql`(employee_id = ${employeeId}::uuid OR tip_employee_id = ${employeeId}::uuid)`
      : sql`employee_id = ${employeeId}::uuid`;
    const notesUpdate = notes === undefined ? sql`` : sql`, notes = ${notes}`;
    const result = await tx.execute(sql`
      UPDATE time_clock_entries
      SET clock_out = NOW(), updated_at = NOW() ${notesUpdate}
      WHERE id = ${entryId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND ${employeePredicate}
        AND clock_out IS NULL
      RETURNING id, clock_out
    `);
    const row = result.rows[0] as { id: string; clock_out: Date } | undefined;
    if (!row) throw new ClockEntryNotOpenError();

    await tx.execute(sql`
      UPDATE time_clock_breaks
      SET break_end = ${row.clock_out}
      WHERE time_clock_entry_id = ${entryId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND break_end IS NULL
    `);
    return row;
  });
}
