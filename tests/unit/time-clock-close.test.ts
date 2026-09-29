import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn() }));
vi.mock('../../server/db', () => ({ db: { transaction: mocks.transaction } }));
import { ClockEntryNotOpenError, closeClockEntry } from '../../server/timeClockService';

const tenantId = '11111111-1111-1111-1111-111111111111';
const employeeId = '22222222-2222-2222-2222-222222222222';
const entryId = '33333333-3333-3333-3333-333333333333';
const dialect = new PgDialect();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((callback) => callback({ execute: mocks.execute }));
});

describe('closeClockEntry', () => {
  it('closes an owned open shift before ending breaks with the identical timestamp', async () => {
    const clockOut = new Date('2026-09-29T13:00:00Z');
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: entryId, clock_out: clockOut }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(closeClockEntry(tenantId, employeeId, entryId)).resolves.toEqual({ id: entryId, clock_out: clockOut });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    const entryQuery = dialect.sqlToQuery(mocks.execute.mock.calls[0][0]);
    const breakQuery = dialect.sqlToQuery(mocks.execute.mock.calls[1][0]);
    expect(entryQuery.sql).toContain('clock_out IS NULL');
    expect(entryQuery.sql).toContain('employee_id =');
    expect(entryQuery.sql).not.toContain('tip_employee_id');
    expect(breakQuery.sql).toContain('break_end IS NULL');
    expect(breakQuery.params).toContain(clockOut);
    expect(entryQuery.params).toContain(tenantId);
    expect(entryQuery.params).toContain(employeeId);
    expect(entryQuery.params).toContain(entryId);
  });

  it('does not alter breaks when a duplicate or unauthorized clock-out has no open shift', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    await expect(closeClockEntry(tenantId, employeeId, entryId)).rejects.toBeInstanceOf(ClockEntryNotOpenError);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('permits tip roster employees only on the kiosk path', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: entryId, clock_out: new Date() }] })
      .mockResolvedValueOnce({ rows: [] });
    await closeClockEntry(tenantId, employeeId, entryId, true);
    expect(dialect.sqlToQuery(mocks.execute.mock.calls[0][0]).sql).toContain('tip_employee_id');
  });

  it('propagates a break failure through the transaction', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: entryId, clock_out: new Date() }] })
      .mockRejectedValueOnce(new Error('DB failure'));
    await expect(closeClockEntry(tenantId, employeeId, entryId)).rejects.toThrow('DB failure');
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
