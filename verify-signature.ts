/**
 * Verifies that an incoming webhook actually came from Karbon.
 *
 * Karbon signs each webhook payload with HMAC-SHA256 using the SigningKey
 * you supplied when you created the subscription. The signature arrives in
 * the `Signature` header as a hex digest. You MUST hash the raw request
 * body — not a parsed/re-serialized version — or the signature will never
 * match, since JSON.stringify can reorder keys or change whitespace.
 */

import { createHmac, timingSafeEqual } from "crypto";

export function verifyKarbonSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", signingKey).update(rawBody, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
