import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const ORIGIN = "https://pedro.example";

function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`, init));
}

function contact(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetchWorker("/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "CF-Connecting-IP": "203.0.113.7",
      ...headers,
    },
  });
}

const message = {
  name: "Mercy Seat",
  email: "office@example.org",
  message: "We would like a prayer wall for our church site.",
};

async function clearKv(): Promise<void> {
  const { keys } = await env.CONTACT_KV.list();
  await Promise.all(keys.map((key) => env.CONTACT_KV.delete(key.name)));
}

describe("worker", () => {
  beforeEach(clearKv);

  it("serves the landing page with security headers", async () => {
    const res = await fetchWorker("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(await res.text()).toContain("Pedro M. Dominguez");
  });

  it("returns the 404 page for unknown paths", async () => {
    const res = await fetchWorker("/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404");
  });

  it("reports health", async () => {
    const res = await fetchWorker("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "1.0.0" });
  });

  it("stores a valid contact message in KV", async () => {
    const res = await contact(message);
    expect(res.status).toBe(201);
    const keys = await env.CONTACT_KV.list({ prefix: "msg:" });
    expect(keys.keys).toHaveLength(1);
    const stored = await env.CONTACT_KV.get(keys.keys[0]!.name, "json");
    expect(stored).toMatchObject({ name: "Mercy Seat", email: "office@example.org" });
  });

  it("rejects cross-origin posts", async () => {
    const res = await contact(message, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("returns field errors for invalid input", async () => {
    const res = await contact({ name: "", email: "x", message: "" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "validation_failed" });
  });

  it("silently drops honeypot submissions", async () => {
    const res = await contact({ ...message, website: "spam" });
    expect(res.status).toBe(201);
    const keys = await env.CONTACT_KV.list({ prefix: "msg:" });
    expect(keys.keys).toHaveLength(0);
  });

  it("rate limits after five messages", async () => {
    for (let i = 0; i < 5; i++) expect((await contact(message)).status).toBe(201);
    const res = await contact(message);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("rejects wrong methods with Allow", async () => {
    const res = await fetchWorker("/api/contact");
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
