import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  link: vi.fn(),
  audit: vi.fn(),
  log: vi.fn(),
}));
vi.mock('../../server/db', () => ({ db: { execute: mocks.execute, transaction: mocks.transaction } }));
vi.mock('../../server/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: mocks.create, deleteUser: mocks.remove, generateLink: mocks.link } },
  }),
}));
vi.mock('../../server/routes/core', () => ({
  getUserIdFromRequest: mocks.identity,
  getTrustedBaseUrl: () => 'https://coffeemanagementsuite.com',
  authRateLimit: vi.fn(),
  logAuditEvent: mocks.audit,
}));
vi.mock('../../server/logger', () => ({ default: { error: mocks.log } }));
import { registerStaffAccessRoutes } from '../../server/routes/staff-access';
const tenant = '00000000-0000-0000-0000-000000000100',
  manager = '00000000-0000-0000-0000-000000000001',
  worker = '00000000-0000-0000-0000-000000000002',
  tip = '00000000-0000-0000-0000-000000000003';
const body = { tenantId: tenant, action: 'create', fullName: 'Lauren', loginId: 'cob-lauren' };
let handler: (req: Request, res: Response) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ userId: manager });
  mocks.execute.mockResolvedValue({ rows: [{ role: 'manager' }] });
  mocks.transaction.mockImplementation((fn) => fn({ execute: mocks.execute }));
  mocks.create.mockResolvedValue({ data: { user: { id: worker } }, error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.link.mockResolvedValue({
    data: { properties: { action_link: 'https://auth.example/setup-secret' } },
    error: null,
  });
  registerStaffAccessRoutes({
    post: (_path: string, ...args: unknown[]) => {
      handler = args.at(-1) as typeof handler;
    },
  } as unknown as Express);
});
async function request(value: unknown) {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ body: value, ip: 'test' } as Request, res as unknown as Response);
  return res;
}
describe('staff account provisioning', () => {
  it('requires authentication and manager membership before creating an account', async () => {
    mocks.identity.mockResolvedValueOnce({ userId: null });
    expect((await request(body)).status).toHaveBeenCalledWith(401);
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    expect((await request(body)).status).toHaveBeenCalledWith(403);
    mocks.execute.mockResolvedValueOnce({ rows: [{ role: 'employee' }] });
    expect((await request(body)).status).toHaveBeenCalledWith(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('creates an employee with an undisclosed random password and a private setup link', async () => {
    const res = await request({ ...body, role: 'owner', actorId: worker });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      email: 'cob-lauren@staff.coffeemanagementsuite.invalid',
      email_confirm: true,
    });
    expect(mocks.create.mock.calls[0][0].password.length).toBeGreaterThan(30);
    expect(mocks.link).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'cob-lauren@staff.coffeemanagementsuite.invalid',
      options: { redirectTo: 'https://coffeemanagementsuite.com/reset-password' },
    });
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('password');
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]);
    expect(query.sql).toContain("'employee'");
    expect(mocks.audit.mock.calls[0][1]).toBe(manager);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('setup-secret');
  });
  it('never takes over an existing auth identity after a duplicate staff ID', async () => {
    mocks.create.mockResolvedValue({ data: { user: null }, error: { message: 'already exists' } });
    expect((await request(body)).status).toHaveBeenCalledWith(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.link).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('removes only the new auth user if profile/link transaction fails', async () => {
    mocks.transaction.mockRejectedValue(new Error('failed transaction'));
    const res = await request(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.remove).toHaveBeenCalledWith(worker);
    expect(mocks.link).not.toHaveBeenCalled();
  });
  it('retains a successfully saved identity when setup-link generation fails', async () => {
    mocks.link.mockResolvedValue({ data: { properties: null }, error: { message: 'unavailable' } });
    const res = await request(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ profileId: worker, setupLink: null }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('blocks stale or cross-location roster selections before auth creation', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ role: 'manager' }] }).mockResolvedValueOnce({ rows: [] });
    expect((await request({ ...body, tipEmployeeId: tip })).status).toHaveBeenCalledWith(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('blocks a manager from resetting privileged or missing accounts', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ role: 'owner', email: 'owner@example.com', staff_login_id: 'owner' }] });
    expect((await request({ tenantId: tenant, action: 'setup', profileId: worker })).status).toHaveBeenCalledWith(403);
    mocks.execute.mockResolvedValueOnce({ rows: [{ role: 'manager' }] }).mockResolvedValueOnce({ rows: [] });
    expect((await request({ tenantId: tenant, action: 'setup', profileId: worker })).status).toHaveBeenCalledWith(404);
    expect(mocks.link).not.toHaveBeenCalled();
  });
  it('passes only the verified actor into the server-only link function', async () => {
    await request({ tenantId: tenant, action: 'link', tipEmployeeId: tip, profileId: worker, actorId: worker });
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]);
    expect(query.params).toEqual([manager, tenant, tip, worker]);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects malformed identities before querying or calling Auth', async () => {
    expect((await request({ ...body, loginId: 'invalid id' })).status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
