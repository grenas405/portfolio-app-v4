/** GET /api/health — liveness and version. */
import type { Env } from "../env";
import { json } from "../http/responses";

export function handleHealth(env: Env, nowMs: number): Response {
  return json({ status: "ok", version: env.APP_VERSION, time: new Date(nowMs).toISOString() });
}
