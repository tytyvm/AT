import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Alchemy's x-alchemy-signature header (HMAC-SHA256 of the raw body). */
export function verifySignature(body: string, signature: string | null, key: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", key).update(body, "utf8").digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
