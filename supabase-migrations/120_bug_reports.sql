-- Bug Reports: in-app bug submission system
-- Tenants submit bugs from settings; Platform Admins triage and manage

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_by_name text,
  submitted_by_email text,
  title text not null,
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for common queries
create index if not exists idx_bug_reports_tenant on bug_reports(tenant_id);
create index if not exists idx_bug_reports_status on bug_reports(status);
create index if not exists idx_bug_reports_created on bug_reports(created_at desc);

-- RLS
alter table bug_reports enable row level security;

-- Users can insert bug reports for their own tenant (or platform admins for any tenant)
create policy "Users can submit bug reports for their tenant"
  on bug_reports for insert
  with check (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Users can view their own tenant's bug reports (including multi-tenant assignments)
create policy "Users can view their tenant bug reports"
  on bug_reports for select
  using (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid() AND is_active = true)
  );

-- Platform admins can view all bug reports
create policy "Platform admins can view all bug reports"
  on bug_reports for select
  using (
    EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Platform admins can update any bug report (status, admin_notes)
create policy "Platform admins can update bug reports"
  on bug_reports for update
  using (
    EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Auto-update updated_at
create or replace function update_bug_reports_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bug_reports_updated_at
  before update on bug_reports
  for each row
  execute function update_bug_reports_updated_at();
