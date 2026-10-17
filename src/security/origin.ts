/** CSRF guard: state-changing requests must come from this site. */

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (origin === null) return false;
  if (origin !== new URL(request.url).origin) return false;
  const site = request.headers.get("Sec-Fetch-Site");
  return site === null || site === "same-origin";
}
