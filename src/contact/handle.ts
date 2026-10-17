/**
 * POST /api/contact
 * origin check -> bounded body -> validation -> rate limit -> KV write.
 * Each step returns an explicit HTTP error; nothing internal is leaked.
 */
import type { Env } from "../env";
import { apiError, json } from "../http/responses";
import { readBoundedJson, type BodyError } from "../security/body";
import { isSameOrigin } from "../security/origin";
import { consumeRateLimit, hashClientId, type RateLimitPolicy } from "../security/rate_limit";
import { validateContact, type ContactMessage } from "./validate";

export const MAX_BODY_BYTES = 8 * 1024;
export const CONTACT_RATE_LIMIT: RateLimitPolicy = { limit: 5, windowSeconds: 600 };
export const MESSAGE_TTL_SECONDS = 60 * 60 * 24 * 90;

export type ContactContext = {
  readonly nowMs: number;
  readonly id: string;
};

const BODY_ERROR_STATUS: Readonly<Record<BodyError, number>> = {
  unsupported_media_type: 415,
  payload_too_large: 413,
  invalid_json: 400,
};

export type StoredMessage = ContactMessage & {
  readonly id: string;
  readonly receivedAt: string;
};

export function messageKey(receivedAt: string, id: string): string {
  return `msg:${receivedAt}:${id}`;
}

export function toStoredMessage(message: ContactMessage, ctx: ContactContext): StoredMessage {
  return { ...message, id: ctx.id, receivedAt: new Date(ctx.nowMs).toISOString() };
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

const ACCEPTED = { ok: true, message: "received" } as const;

export async function handleContact(
  request: Request,
  env: Env,
  ctx: ContactContext,
): Promise<Response> {
  if (!isSameOrigin(request)) return apiError(403, "forbidden_origin");

  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return apiError(BODY_ERROR_STATUS[body.error], body.error);

  const validated = validateContact(body.value);
  if (!validated.ok && validated.error.kind === "spam") return json(ACCEPTED, 201);
  if (!validated.ok) {
    const fields = validated.error.kind === "invalid" ? validated.error.fields : {};
    return json({ ok: false, error: "validation_failed", fields }, 422);
  }

  const client = await hashClientId(clientIp(request));
  const limit = await consumeRateLimit(env.CONTACT_KV, client, ctx.nowMs, CONTACT_RATE_LIMIT);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const stored = toStoredMessage(validated.value, ctx);
  await env.CONTACT_KV.put(messageKey(stored.receivedAt, stored.id), JSON.stringify(stored), {
    expirationTtl: MESSAGE_TTL_SECONDS,
  });
  return json(ACCEPTED, 201);
}
