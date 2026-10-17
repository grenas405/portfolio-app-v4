/** Static asset serving through the ASSETS binding. */
import type { Env } from "../env";

export const NOT_FOUND_PAGE = "/html/404.html";

function assetRequest(request: Request, assetPath: string): Request {
  return new Request(new URL(assetPath, request.url), {
    method: request.method,
    headers: request.headers,
  });
}

async function notFoundPage(request: Request, env: Env): Promise<Response> {
  const page = await env.ASSETS.fetch(assetRequest(request, NOT_FOUND_PAGE));
  return new Response(page.body, { status: 404, headers: page.headers });
}

export async function servePage(request: Request, env: Env, assetPath: string): Promise<Response> {
  const page = await env.ASSETS.fetch(assetRequest(request, assetPath));
  return page.status === 404 ? notFoundPage(request, env) : page;
}

export async function serveAsset(request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(request);
  return asset.status === 404 ? notFoundPage(request, env) : asset;
}
