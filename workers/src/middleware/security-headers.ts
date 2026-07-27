// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Security Headers Middleware                    │
// │ Platform-wide HTTP security headers for all AGS products.   │
// │ Wave 8.1 — Production Hardening & Security Closure          │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: No PHI in headers. Pure infrastructure.
// Reusable: Every AGS product applies this middleware identically.

export interface SecurityHeadersConfig {
  /** Enable HSTS (set false for HTTP dev servers). */
  hsts: boolean;
  /** Content Security Policy directive. */
  csp: string;
  /** X-Frame-Options value. */
  frameOptions: string;
  /** X-Content-Type-Options value. */
  contentTypeOptions: string;
  /** Referrer-Policy value. */
  referrerPolicy: string;
  /** Permissions-Policy value. */
  permissionsPolicy: string;
  /** Cache-Control for API responses. */
  cacheControl: string;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  hsts: true,
  csp: [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://agsynergy.ca https://www.agsynergy.ca",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  frameOptions: "DENY",
  contentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: "camera=(), microphone=(), geolocation=(), payment=()",
  cacheControl: "no-store, no-cache, must-revalidate",
};

/**
 * Apply security headers to a Response.
 * Call AFTER the route handler produces the response.
 */
export function applySecurityHeaders(
  response: Response,
  config: Partial<SecurityHeadersConfig> = {},
): Response {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const headers = new Headers(response.headers);

  // HSTS — only over HTTPS
  if (cfg.hsts) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  headers.set("Content-Security-Policy", cfg.csp);
  headers.set("X-Frame-Options", cfg.frameOptions);
  headers.set("X-Content-Type-Options", cfg.contentTypeOptions);
  headers.set("Referrer-Policy", cfg.referrerPolicy);
  headers.set("Permissions-Policy", cfg.permissionsPolicy);

  // API responses: no caching by default
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", cfg.cacheControl);
  }

  // Remove server identification
  headers.delete("Server");
  headers.delete("X-Powered-By");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
