/** Bound and canonicalize untrusted input before the legacy Intuit query decoder. */
export function safeQboCallbackUrl(input: string): string {
  const invalid = () => new Error('Invalid QuickBooks OAuth callback');
  if (input.length > 8192) throw invalid();
  let url: URL;
  try {
    url = new URL(input);
    // Fail closed instead of entering decode-uri-component's costly fallback.
    decodeURIComponent(url.search);
  } catch {
    throw invalid();
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.hash || url.username || url.password) throw invalid();
  const clean = new URLSearchParams();
  for (const field of ['code', 'state', 'realmId']) {
    const values = url.searchParams.getAll(field);
    if (values.length !== 1 || !values[0] || /[\u0000-\u001f\u007f]/.test(values[0])) throw invalid();
    clean.set(field, values[0]);
  }
  // In particular, never allow callback input to override the configured redirectUri.
  url.search = clean.toString();
  return url.toString();
}
