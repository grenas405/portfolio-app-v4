/** Bounded JSON body reading. Never buffers more than maxBytes. */
import { err, ok, type Result } from "../lib/result";

export type BodyError = "unsupported_media_type" | "payload_too_large" | "invalid_json";

function isJsonContentType(value: string | null): boolean {
  return value !== null && value.toLowerCase().split(";")[0]?.trim() === "application/json";
}

function declaredTooLarge(value: string | null, maxBytes: number): boolean {
  if (value === null) return false;
  const length = Number(value);
  return !Number.isFinite(length) || length > maxBytes;
}

async function readLimited(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Result<Uint8Array, BodyError>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return err("payload_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return ok(bytes);
}

function parseJson(bytes: Uint8Array): Result<unknown, BodyError> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return ok(JSON.parse(text) as unknown);
  } catch {
    return err("invalid_json");
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<Result<unknown, BodyError>> {
  if (!isJsonContentType(request.headers.get("Content-Type"))) {
    return err("unsupported_media_type");
  }
  if (declaredTooLarge(request.headers.get("Content-Length"), maxBytes)) {
    return err("payload_too_large");
  }
  if (request.body === null) return err("invalid_json");
  const bytes = await readLimited(request.body, maxBytes);
  return bytes.ok ? parseJson(bytes.value) : bytes;
}
