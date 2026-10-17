import { describe, expect, it } from "vitest";
import { resolveRoute } from "../src/router";

describe("resolveRoute", () => {
  it("maps / to the landing page", () => {
    expect(resolveRoute("GET", "/")).toEqual({ kind: "page", assetPath: "/html/index.html" });
  });
  it("serves other GET paths as assets", () => {
    expect(resolveRoute("GET", "/css/tokens.css")).toEqual({ kind: "asset" });
    expect(resolveRoute("HEAD", "/js/main.js")).toEqual({ kind: "asset" });
  });
  it("rejects writes to static paths", () => {
    expect(resolveRoute("POST", "/")).toEqual({ kind: "method_not_allowed", allow: "GET, HEAD" });
  });
  it("routes the API", () => {
    expect(resolveRoute("GET", "/api/health")).toEqual({ kind: "health" });
    expect(resolveRoute("POST", "/api/contact")).toEqual({ kind: "contact" });
    expect(resolveRoute("GET", "/api/contact")).toEqual({ kind: "method_not_allowed", allow: "POST" });
    expect(resolveRoute("GET", "/api/nope")).toEqual({ kind: "api_not_found" });
  });
});
