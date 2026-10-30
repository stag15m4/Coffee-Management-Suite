# QuickBooks OAuth callback security review

Status: implemented in source, not deployed. Prepared October 30, 2026. This change builds on the dependency refresh in PR 63.

## Finding and compatibility decision

The installed chain is intuit-oauth 4.2.2 → query-string 6.14.1 → decode-uri-component 0.2.2. The SDK parses the callback query in createToken. Its authorizeUri method stringifies values; token refresh and revocation do not use this callback parser.

The decoder has malformed-input denial-of-service advisories:

- [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
- [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)

The latter lists 0.5.1 as patched. Registry metadata identifies that version as ESM, whereas this query-string version requires a callable CommonJS export. Do not force an untested override: npm reports no automatic fix for this installed chain. A future SDK/dependency replacement remains required.

## Application mitigation

Before the SDK parses the callback, safeQboCallbackUrl:

1. Rejects input longer than 8,192 characters.
2. Rejects malformed percent encodings with the native decoder, avoiding the legacy decoder's fallback.
3. Requires exactly one nonempty code, state and realmId, including checks against encoded duplicate keys.
4. Rejects control characters, fragments and credential-bearing URLs.
5. Re-encodes only those three fields and drops all others, including redirectUri. Intuit's configured redirect URI remains authoritative.

Errors do not contain the input URL or authorization code. Existing route-level one-time state validation and expiry checks remain in place; this helper does not replace CSRF checks. No payroll scope, token storage, refresh, revocation or tenant permission changes are included.

The 8,192-character limit is an application limit, not an asserted Intuit maximum. Before release, verify a real sandbox connection fits it and succeeds. No live OAuth grant or token was used in local tests.

## Evidence and limitations

Tests exercise malformed/oversized input, duplicates, token-value preservation and the actual installed Intuit createToken parser with network requests stubbed. They verify code decoding and use of the configured redirect URI. Full test/typecheck/build results belong in the PR.

This is a compensating application control. It does not remove the vulnerable dependency, resolve other decoder consumers or lower the npm advisory count. Continue to track the QuickBooks dependency chain as open until a compatible patched library is deployed. The remaining Drizzle, Zod, ip-address and nanoid findings also remain open.

No production change, account reconnection or database migration is performed by this work. After release, perform an authorized sandbox OAuth connection test; do not disconnect the working production account solely for testing.
