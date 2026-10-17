/**
 * Worker entry. Composition only: route -> handler -> security headers.
 */
import { handleContact } from "./contact/handle";
import type { Env } from "./env";
import { handleHealth } from "./health/handle";
import { serveAsset, servePage } from "./http/assets";
import { apiError, methodNotAllowed } from "./http/responses";
import { resolveRoute, type Route } from "./router";
import { withSecurityHeaders } from "./security/headers";

function dispatch(route: Route, request: Request, env: Env): Promise<Response> | Response {
  switch (route.kind) {
    case "health":
      return handleHealth(env, Date.now());
    case "contact":
      return handleContact(request, env, { nowMs: Date.now(), id: crypto.randomUUID() });
    case "page":
      return servePage(request, env, route.assetPath);
    case "asset":
      return serveAsset(request, env);
    case "method_not_allowed":
      return methodNotAllowed(route.allow);
    case "api_not_found":
      return apiError(404, "not_found");
  }
}

async function handle(request: Request, env: Env): Promise<Response> {
  const route = resolveRoute(request.method, new URL(request.url).pathname);
  try {
    return await dispatch(route, request, env);
  } catch (error) {
    // Log the failure class only; never echo internals to the client.
    console.error("unhandled", route.kind, error instanceof Error ? error.name : "unknown");
    return apiError(500, "internal_error");
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    return withSecurityHeaders(await handle(request, env));
  },
} satisfies ExportedHandler<Env>;
