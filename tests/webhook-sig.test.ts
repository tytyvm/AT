import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/alchemy-sig";

describe("Alchemy webhook signature", () => {
  const body = JSON.stringify({ event: { activity: [] } });
  const sig = createHmac("sha256", "k").update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifySignature(body, sig, "k")).toBe(true));
  it("rejects a tampered body", () => expect(verifySignature(body + " ", sig, "k")).toBe(false));
  it("rejects a missing header", () => expect(verifySignature(body, null, "k")).toBe(false));
});
