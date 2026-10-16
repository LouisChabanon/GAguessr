/**
 * Whether a request comes from this site's own pages. Route handlers that change state check it,
 * as Server Actions do on their own: a cross-site form or script must not act with the visitor's
 * cookies. Browsers send Sec-Fetch-Site; older ones only Origin, compared with the request's host.
 */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
