/**
 * Validate the canonical public origin before accepting production traffic.
 * Never include the configured value in errors: it could contain credentials.
 */
export function getProductionOrigin(nodeEnv: string | undefined, appUrl: string | undefined): string | null {
  if (nodeEnv !== 'production') return null;
  const message = 'Production APP_URL must be an HTTPS origin without credentials, path, query, or fragment';
  if (!appUrl || appUrl !== appUrl.trim()) throw new Error(message);
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    throw new Error(message);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(message);
  }
  return url.origin;
}

/** Concatenation deliberately keeps protocol-relative request paths on our origin. */
export function getHttpsRedirect(origin: string, originalUrl: string): string {
  return origin + (originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl);
}
