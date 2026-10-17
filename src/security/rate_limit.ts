/**
 * Fixed-window rate limiting stored in KV. Clients are identified by a
 * SHA-256 hash of their IP so raw addresses are never stored.
 *
 * KV is eventually consistent, so this is a best-effort brake on abuse,
 * not an exact counter.
 */

export type RateLimitPolicy = {
  readonly limit: number;
  readonly windowSeconds: number;
};

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
};

const MIN_KV_TTL_SECONDS = 60;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashClientId(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return toHex(digest);
}

export function windowStart(nowMs: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function rateLimitKey(clientHash: string, nowMs: number, windowSeconds: number): string {
  return `rl:${clientHash}:${windowStart(nowMs, windowSeconds)}`;
}

export function decide(count: number, nowMs: number, policy: RateLimitPolicy): RateLimitDecision {
  const windowEnd = windowStart(nowMs, policy.windowSeconds) + policy.windowSeconds * 1000;
  return {
    allowed: count < policy.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
  };
}

export function parseCount(value: string | null): number {
  const n = value === null ? 0 : Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** Reads the counter, and increments it when the request is allowed. */
export async function consumeRateLimit(
  kv: KVNamespace,
  clientHash: string,
  nowMs: number,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const key = rateLimitKey(clientHash, nowMs, policy.windowSeconds);
  const count = parseCount(await kv.get(key));
  const decision = decide(count, nowMs, policy);
  if (decision.allowed) {
    await kv.put(key, String(count + 1), {
      expirationTtl: Math.max(MIN_KV_TTL_SECONDS, policy.windowSeconds),
    });
  }
  return decision;
}
