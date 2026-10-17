/** Pure validation of contact form input. Server-side, allow-list based. */
import { err, ok, type Result } from "../lib/result";

export type ContactMessage = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly organization: string;
  readonly message: string;
};

export type FieldErrors = Readonly<Partial<Record<keyof ContactMessage, string>>>;

export type ContactRejection =
  | { readonly kind: "invalid"; readonly fields: FieldErrors }
  | { readonly kind: "spam" };

type FieldRule = {
  readonly required: boolean;
  readonly min: number;
  readonly max: number;
  readonly multiline: boolean;
  readonly pattern?: RegExp;
};

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const PHONE = /^[0-9+()\-.\s]{7,30}$/;

export const RULES: Readonly<Record<keyof ContactMessage, FieldRule>> = {
  name: { required: true, min: 2, max: 100, multiline: false },
  email: { required: true, min: 6, max: 254, multiline: false, pattern: EMAIL },
  phone: { required: false, min: 7, max: 30, multiline: false, pattern: PHONE },
  organization: { required: false, min: 2, max: 120, multiline: false },
  message: { required: true, min: 10, max: 2000, multiline: true },
};

// C0/C1 control characters, minus tab/newline for multiline fields.
const CONTROL_SINGLE = /[\u0000-\u001F\u007F-\u009F]/g;
const CONTROL_MULTI = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

export function clean(value: unknown, multiline: boolean): string {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n");
  return normalized.replace(multiline ? CONTROL_MULTI : CONTROL_SINGLE, "").trim();
}

function checkField(value: string, rule: FieldRule): string | undefined {
  if (value.length === 0) return rule.required ? "required" : undefined;
  if (value.length > rule.max) return "too_long";
  if (rule.pattern !== undefined && !rule.pattern.test(value)) return "invalid_format";
  if (value.length < rule.min) return "too_short";
  return undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function validateContact(input: unknown): Result<ContactMessage, ContactRejection> {
  if (!isRecord(input)) return err({ kind: "invalid", fields: { message: "required" } });
  // Honeypot: a hidden field that people never fill in, but bots do.
  if (clean(input["website"], false) !== "") return err({ kind: "spam" });

  const keys = Object.keys(RULES) as (keyof ContactMessage)[];
  const values = Object.fromEntries(
    keys.map((key) => [key, clean(input[key], RULES[key].multiline)]),
  ) as Record<keyof ContactMessage, string>;
  const fields = Object.fromEntries(
    keys
      .map((key) => [key, checkField(values[key], RULES[key])] as const)
      .filter(([, problem]) => problem !== undefined),
  ) as FieldErrors;

  if (Object.keys(fields).length > 0) return err({ kind: "invalid", fields });
  return ok({ ...values, email: values.email.toLowerCase() });
}
