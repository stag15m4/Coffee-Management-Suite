import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Re-implement getTrustedBaseUrl as a pure function for testing.
// The original lives inside server/routes.ts registerRoutes() scope and isn't exported,
// so we replicate the exact logic here. If the source changes, these tests should be
// updated to match.
function getTrustedBaseUrl(req: { get: (header: string) => string | undefined; protocol: string }): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  // Only trust hosts that match known patterns
  if (host.startsWith('localhost') || host.endsWith('.app.github.dev') || host.endsWith('.preview.app.github.dev')) {
    return `${proto}://${host}`;
  }
  // Reject unknown hosts — require APP_URL in production
  throw new Error('APP_URL environment variable must be set for this operation');
}

/** Helper to build a minimal request-like object */
function fakeReq(headers: Record<string, string> = {}, protocol = 'http') {
  return {
    protocol,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

describe('getTrustedBaseUrl', () => {
  const originalEnv = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.APP_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.APP_URL = originalEnv;
    } else {
      delete process.env.APP_URL;
    }
  });

  it('returns APP_URL when set, ignoring request headers', () => {
    process.env.APP_URL = 'https://app.coffeemanagementsuite.com';
    const req = fakeReq({ host: 'evil.example.com' }, 'http');
    expect(getTrustedBaseUrl(req)).toBe('https://app.coffeemanagementsuite.com');
  });

  it('returns localhost URL when host is localhost', () => {
    const req = fakeReq({ host: 'localhost:5001' }, 'http');
    expect(getTrustedBaseUrl(req)).toBe('http://localhost:5001');
  });

  it('returns localhost URL without port', () => {
    const req = fakeReq({ host: 'localhost' }, 'http');
    expect(getTrustedBaseUrl(req)).toBe('http://localhost');
  });

  it('detects Codespace host (*.app.github.dev)', () => {
    const req = fakeReq(
      {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'username-coffee-abc123-5001.app.github.dev',
      },
      'http'
    );
    expect(getTrustedBaseUrl(req)).toBe('https://username-coffee-abc123-5001.app.github.dev');
  });

  it('detects Codespace preview host (*.preview.app.github.dev)', () => {
    const req = fakeReq(
      {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'abc123.preview.app.github.dev',
      },
      'http'
    );
    expect(getTrustedBaseUrl(req)).toBe('https://abc123.preview.app.github.dev');
  });

  it('uses x-forwarded-proto over req.protocol', () => {
    const req = fakeReq({ 'x-forwarded-proto': 'https', host: 'localhost:5001' }, 'http');
    expect(getTrustedBaseUrl(req)).toBe('https://localhost:5001');
  });

  it('throws for unknown host when APP_URL is not set', () => {
    const req = fakeReq({ host: 'malicious.example.com' }, 'https');
    expect(() => getTrustedBaseUrl(req)).toThrow('APP_URL environment variable must be set for this operation');
  });

  it('throws for empty host when APP_URL is not set', () => {
    const req = fakeReq({}, 'http');
    expect(() => getTrustedBaseUrl(req)).toThrow('APP_URL environment variable must be set for this operation');
  });
});
