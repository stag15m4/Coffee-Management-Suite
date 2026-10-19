import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';
const execute = vi.hoisted(() => vi.fn());
vi.mock('../../server/db', () => ({ db: { execute, transaction: vi.fn(async (fn) => fn({ execute })) } }));
import pg from 'pg';
import { registerComplianceRoutes } from '../../server/routes/compliance';
const handlers = new Map<string, (req: Request, res: Response) => Promise<void>>();
registerComplianceRoutes({
  get: (path: string, fn: (req: Request, res: Response) => Promise<void>) => handlers.set(path, fn),
} as unknown as Express);
afterEach(() => {
  vi.unstubAllEnvs();
  execute.mockReset();
});
const id = '11111111-1111-4111-8111-111111111111';
async function request(path: string, tenant?: string) {
  const result = { status: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    status: (code: number) => {
      result.status = code;
      return res;
    },
    json: (body: unknown) => {
      result.body = body;
    },
    setHeader: (key: string, value: string) => {
      result.headers[key] = value;
    },
  };
  await handlers.get(path)!(
    { headers: { 'x-compliance-token': 'read-only' }, query: { tenant_id: tenant } } as unknown as Request,
    res as unknown as Response
  );
  return result;
}
describe('Legal compliance source', () => {
  it('fails closed without a configured key or authorized tenants', async () => {
    expect((await request('/api/integrations/compliance/tenants')).status).toBe(401);
    vi.stubEnv('COMPLIANCE_SERVICE_TOKEN', 'read-only');
    vi.stubEnv('COMPLIANCE_ALLOWED_TENANT_IDS', '');
    expect((await request('/api/integrations/compliance/tenants')).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects a different business before querying', async () => {
    vi.stubEnv('COMPLIANCE_SERVICE_TOKEN', 'read-only');
    vi.stubEnv('COMPLIANCE_ALLOWED_TENANT_IDS', id);
    expect((await request('/api/integrations/compliance', 'another')).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
  it('returns completion and civil dates in the shared snapshot', async () => {
    vi.stubEnv('COMPLIANCE_SERVICE_TOKEN', 'read-only');
    vi.stubEnv('COMPLIANCE_ALLOWED_TENANT_IDS', id);
    execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'task-1',
          title: 'License',
          due_date: pg.types.getTypeParser(1082)('2027-10-27'),
          status: 'completed',
          completed_at: '2027-10-26T12:00:00Z',
          recurrence: 'yearly',
          updated_at: '2027-10-26T12:00:00Z',
        },
      ],
    });
    const res = await request('/api/integrations/compliance', id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      version: 1,
      complete: true,
      business_id: id,
      deadlines: [
        {
          id: 'task-1',
          due_date: '2027-10-27',
          status: 'completed',
          completed_date: '2027-10-26',
          recurrence: 'yearly',
        },
      ],
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});
