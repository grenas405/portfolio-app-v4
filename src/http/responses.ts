/** Pure Response builders. Error bodies never include internal details. */

const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

export function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(API_HEADERS);
  new Headers(extra).forEach((value, name) => headers.set(name, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function apiError(status: number, code: string, extra: HeadersInit = {}): Response {
  return json({ ok: false, error: code }, status, extra);
}

export function methodNotAllowed(allow: string): Response {
  return apiError(405, "method_not_allowed", { Allow: allow });
}

export function plainText(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
