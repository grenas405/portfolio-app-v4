import { describe, expect, it } from "vitest";
import { readBoundedJson } from "../src/security/body";
import { withSecurityHeaders } from "../src/security/headers";
import { isSameOrigin } from "../src/security/origin";
import { decide, parseCount, rateLimitKey } from "../src/security/rate_limit";

const URL_ = "https://pedro.example/api/contact";

function post(body: string, headers: Record<string, string>): Request {
  return new Request(URL_, { method: "POST", body, headers });
}

describe("withSecurityHeaders", () => {
  it("adds CSP and friends without dropping existing headers", () => {
    const res = withSecurityHeaders(new Response("x", { headers: { "X-Test": "1" } }));
    expect(res.headers.get("X-Test")).toBe("1");
    expect(res.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age");
  });
});

describe("isSameOrigin", () => {
  it("requires a matching Origin", () => {
    expect(isSameOrigin(post("", { Origin: "https://pedro.example" }))).toBe(true);
    expect(isSameOrigin(post("", { Origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(post("", {}))).toBe(false);
  });
  it("rejects cross-site fetch metadata", () => {
    const req = post("", { Origin: "https://pedro.example", "Sec-Fetch-Site": "cross-site" });
    expect(isSameOrigin(req)).toBe(false);
  });
});

describe("readBoundedJson", () => {
  it("parses JSON within the limit", async () => {
    const result = await readBoundedJson(post('{"a":1}', { "Content-Type": "application/json" }), 64);
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });
  it("rejects other content types", async () => {
    const result = await readBoundedJson(post("a=1", { "Content-Type": "text/plain" }), 64);
    expect(result).toEqual({ ok: false, error: "unsupported_media_type" });
  });
  it("rejects bodies over the limit", async () => {
    const body = JSON.stringify({ a: "x".repeat(100) });
    const result = await readBoundedJson(post(body, { "Content-Type": "application/json" }), 64);
    expect(result).toEqual({ ok: false, error: "payload_too_large" });
  });
  it("rejects malformed JSON", async () => {
    const result = await readBoundedJson(post("{nope", { "Content-Type": "application/json" }), 64);
    expect(result).toEqual({ ok: false, error: "invalid_json" });
  });
});

describe("rate limit helpers", () => {
  const policy = { limit: 5, windowSeconds: 600 };
  it("buckets keys by window", () => {
    expect(rateLimitKey("abc", 0, 600)).toBe("rl:abc:0");
    expect(rateLimitKey("abc", 599_999, 600)).toBe("rl:abc:0");
    expect(rateLimitKey("abc", 600_000, 600)).toBe("rl:abc:600000");
  });
  it("allows until the limit and reports retry time", () => {
    expect(decide(4, 0, policy).allowed).toBe(true);
    expect(decide(5, 0, policy)).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });
  it("treats garbage counters as zero", () => {
    expect(parseCount(null)).toBe(0);
    expect(parseCount("-3")).toBe(0);
    expect(parseCount("abc")).toBe(0);
    expect(parseCount("2")).toBe(2);
  });
});
