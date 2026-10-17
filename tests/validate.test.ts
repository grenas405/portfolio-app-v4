import { describe, expect, it } from "vitest";
import { clean, validateContact } from "../src/contact/validate";

const valid = {
  name: "Robert Rodriguez",
  email: "Owner@Example.com",
  phone: "(405) 555-0100",
  organization: "Heavenly Roofing",
  message: "We need a site that takes quote requests.",
};

describe("validateContact", () => {
  it("accepts a valid message and lowercases the email", () => {
    const result = validateContact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("owner@example.com");
  });
  it("allows optional fields to be empty", () => {
    expect(validateContact({ ...valid, phone: "", organization: undefined }).ok).toBe(true);
  });
  it("reports each invalid field", () => {
    const result = validateContact({ name: "", email: "nope", message: "short" });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid",
        fields: { name: "required", email: "invalid_format", message: "too_short" },
      },
    });
  });
  it("rejects oversize input", () => {
    const result = validateContact({ ...valid, message: "x".repeat(2001) });
    expect(result.ok).toBe(false);
  });
  it("flags the honeypot as spam", () => {
    expect(validateContact({ ...valid, website: "http://spam" })).toEqual({
      ok: false,
      error: { kind: "spam" },
    });
  });
  it("rejects non-object bodies", () => {
    expect(validateContact(["a"]).ok).toBe(false);
    expect(validateContact(null).ok).toBe(false);
  });
});

describe("clean", () => {
  it("strips control characters and trims", () => {
    expect(clean("  Pedro\u0000\u0007 ", false)).toBe("Pedro");
  });
  it("keeps newlines only in multiline fields", () => {
    expect(clean("a\r\nb", true)).toBe("a\nb");
    expect(clean("a\nb", false)).toBe("ab");
  });
  it("returns empty string for non-strings", () => {
    expect(clean(42, false)).toBe("");
  });
});
