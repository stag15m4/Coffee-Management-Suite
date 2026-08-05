-- 149: Alfred write-path confirmation tokens (propose/confirm)
-- Backs the two-step write flow for Alfred: a "propose" call stores the exact
-- resolved change here and returns a single-use token; a "confirm" call redeems
-- it and performs the write. Persisted (not in-memory) so it survives redeploys
-- and works across instances. Server-only: RLS on with no policies, so the
-- anon/authenticated clients can never read it — only the server's service
-- connection touches it.

CREATE TABLE IF NOT EXISTS alfred_confirmation_tokens (
    token TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alfred_conf_tokens_expires ON alfred_confirmation_tokens(expires_at);

ALTER TABLE alfred_confirmation_tokens ENABLE ROW LEVEL SECURITY;
