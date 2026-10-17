/** Pure request routing: (method, pathname) -> Route. No I/O. */

export type Route =
  | { readonly kind: "health" }
  | { readonly kind: "contact" }
  | { readonly kind: "page"; readonly assetPath: string }
  | { readonly kind: "asset" }
  | { readonly kind: "method_not_allowed"; readonly allow: string }
  | { readonly kind: "api_not_found" };

const PAGES: Readonly<Record<string, string>> = {
  "/": "/html/index.html",
  "/index.html": "/html/index.html",
};

const READ_METHODS = "GET, HEAD";

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function resolveApiRoute(method: string, pathname: string): Route {
  if (pathname === "/api/health") {
    return isReadMethod(method)
      ? { kind: "health" }
      : { kind: "method_not_allowed", allow: READ_METHODS };
  }
  if (pathname === "/api/contact") {
    return method === "POST"
      ? { kind: "contact" }
      : { kind: "method_not_allowed", allow: "POST" };
  }
  return { kind: "api_not_found" };
}

export function resolveRoute(method: string, pathname: string): Route {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return resolveApiRoute(method, pathname);
  }
  if (!isReadMethod(method)) {
    return { kind: "method_not_allowed", allow: READ_METHODS };
  }
  const page = PAGES[pathname];
  return page === undefined ? { kind: "asset" } : { kind: "page", assetPath: page };
}
