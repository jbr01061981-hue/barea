/**
 * Validates internal return URL.
 * Strictly prevents open redirects to external protocols or domains.
 * Uses semantic WHATWG URL parsing and strict path normalization.
 */
export function sanitizeReturnTo(returnTo?: string | null): string {
  const DEFAULT_PATH = '/home';
  if (!returnTo || typeof returnTo !== 'string') {
    return DEFAULT_PATH;
  }

  const trimmed = returnTo.trim();
  if (!trimmed) {
    return DEFAULT_PATH;
  }

  // Reject CRLF, null bytes, or any control characters
  if (/[\r\n\x00-\x1f\x7f]/.test(trimmed)) {
    return DEFAULT_PATH;
  }

  // Reject backslashes or encoded backslashes (%5c, %5C)
  if (trimmed.includes('\\') || /%5c/i.test(trimmed)) {
    return DEFAULT_PATH;
  }

  // Reject protocol schemes (e.g. javascript:, data:, vbscript:, http:, https:)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) {
    return DEFAULT_PATH;
  }

  // Reject protocol-relative URLs (e.g. //evil.example or /%2fevil.example or %2f%2f)
  if (trimmed.startsWith('//') || /^\/%2f/i.test(trimmed) || /^%2f%2f/i.test(trimmed)) {
    return DEFAULT_PATH;
  }

  // Must strictly start with a single '/'
  if (!trimmed.startsWith('/')) {
    return DEFAULT_PATH;
  }

  // Semantic parsing using standard URL with a fixed local dummy base
  const dummyBase = 'https://barea.local';
  try {
    const parsed = new URL(trimmed, dummyBase);

    // Origin must remain strictly identical to dummy base (not redirected/overridden)
    if (parsed.origin !== dummyBase) {
      return DEFAULT_PATH;
    }

    // Host, hostname, port, username, password must remain untouched
    if (parsed.hostname !== 'barea.local' || parsed.username || parsed.password || parsed.port) {
      return DEFAULT_PATH;
    }

    // Pathname must start with '/' and not '//'
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return DEFAULT_PATH;
    }

    // Pathname must not contain backslash
    if (parsed.pathname.includes('\\')) {
      return DEFAULT_PATH;
    }

    // Double check that decodeURIComponent on pathname doesn't introduce backslashes or protocol-relative slashes
    try {
      const decodedPath = decodeURIComponent(parsed.pathname);
      if (decodedPath.includes('\\') || decodedPath.startsWith('//')) {
        return DEFAULT_PATH;
      }
    } catch {
      return DEFAULT_PATH;
    }

    // Return the safe relative path (pathname + search + hash)
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    if (!safePath.startsWith('/') || safePath.startsWith('//')) {
      return DEFAULT_PATH;
    }

    return safePath;
  } catch {
    return DEFAULT_PATH;
  }
}

/**
 * Resolves the effective application origin for client-facing redirects.
 *
 * Security Invariants:
 * 1. 0.0.0.0 is an all-interfaces bind address, NOT a valid routable client origin.
 *    Redirecting a client browser to 0.0.0.0 results in ERR_ADDRESS_INVALID and client failure.
 * 2. In production: untrusted request headers (Host, X-Forwarded-Host) or dynamic request origins
 *    must NEVER override configured authority. If NEXT_PUBLIC_APP_URL is set, its origin is authoritative.
 * 3. In local development / test:
 *    - If BAREA_DEV_APP_URL or NEXT_PUBLIC_APP_URL is explicitly configured (e.g. https://192.168.1.7:3000),
 *      it takes precedence over raw socket / bind addresses.
 *    - If the incoming request origin resolves to 0.0.0.0, it is strictly rejected and falls back
 *      to the configured development origin or localhost.
 */
export function resolveEffectiveAppOrigin(requestOrigin?: string | null): string {
  // Check explicit development origin override first (if in non-production)
  if (process.env.NODE_ENV !== 'production') {
    const devAppUrl = process.env.BAREA_DEV_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (devAppUrl && devAppUrl.trim()) {
      try {
        const parsedDev = new URL(devAppUrl.trim());
        if (parsedDev.hostname !== '0.0.0.0') {
          return parsedDev.origin;
        }
      } catch {
        // invalid URL ignored, continue resolution
      }
    }
  } else {
    // In production, NEXT_PUBLIC_APP_URL is authoritative if provided
    const prodAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (prodAppUrl && prodAppUrl.trim()) {
      try {
        const parsedProd = new URL(prodAppUrl.trim());
        return parsedProd.origin;
      } catch {
        // invalid URL ignored
      }
    }
  }

  // Evaluate request origin
  if (requestOrigin && typeof requestOrigin === 'string') {
    try {
      const parsed = new URL(requestOrigin);
      // Strictly prevent 0.0.0.0 from becoming a client redirect destination
      if (parsed.hostname === '0.0.0.0') {
        throw new Error(
          'Invalid application origin: server is bound to 0.0.0.0 which cannot be used for client redirects. ' +
          'Configure BAREA_DEV_APP_URL (e.g. BAREA_DEV_APP_URL=https://<your-lan-ip>:3000 or BAREA_DEV_APP_URL=https://localhost:3000) in your environment.'
        );
      }
      return parsed.origin;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Invalid application origin')) {
        throw err;
      }
      // invalid URL ignored
    }
  }

  return 'http://localhost:3000';
}

/**
 * Resolves the canonical OAuth redirect URI.
 * In production: strictly requires GOOGLE_REDIRECT_URI in the server environment
 * and never allows untrusted request headers (Host/Origin) to dictate redirect URI.
 * In development / test: falls back to effective request origin or http://localhost:3000.
 */
export function resolveOAuthRedirectUri(requestOrigin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GOOGLE_REDIRECT_URI must be configured in production environment.');
  }
  const origin = resolveEffectiveAppOrigin(requestOrigin);
  return `${origin}/api/auth/callback/google`;
}
