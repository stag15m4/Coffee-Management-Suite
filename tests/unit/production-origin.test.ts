import { describe, expect, it } from 'vitest';
import { getHttpsRedirect, getProductionOrigin } from '../../server/production-origin';

describe('production public origin', () => {
  it.each([
    undefined,
    '',
    'not-a-url',
    'http://cms.example',
    'https://user:secret@cms.example',
    'https://cms.example/app',
    'https://cms.example/?next=elsewhere',
    'https://cms.example/#fragment',
    ' https://cms.example',
  ])('rejects unsafe production configuration: %s', (value) => {
    expect(() => getProductionOrigin('production', value)).toThrow('Production APP_URL must be an HTTPS origin');
  });

  it('normalizes a trailing slash and preserves an explicit port', () => {
    expect(getProductionOrigin('production', 'https://cms.example/')).toBe('https://cms.example');
    expect(getProductionOrigin('production', 'https://cms.example:8443')).toBe('https://cms.example:8443');
  });

  it('does not require a public HTTPS origin for development or tests', () => {
    expect(getProductionOrigin('development', undefined)).toBeNull();
    expect(getProductionOrigin('test', 'http://localhost:5001')).toBeNull();
  });

  it('does not expose credentials in configuration errors', () => {
    expect(() => getProductionOrigin('production', 'https://user:secret@cms.example')).toThrow(
      /^Production APP_URL must be an HTTPS origin without credentials, path, query, or fragment$/
    );
  });

  it('preserves paths and query strings', () => {
    expect(getHttpsRedirect('https://cms.example', '/login?next=%2Fdashboard')).toBe(
      'https://cms.example/login?next=%2Fdashboard'
    );
  });

  it('keeps protocol-relative and absolute request targets on the configured origin', () => {
    for (const target of ['//attacker.example/login', 'https://attacker.example', '/\\attacker.example']) {
      expect(new URL(getHttpsRedirect('https://cms.example', target)).origin).toBe('https://cms.example');
    }
  });
});
