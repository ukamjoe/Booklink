import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { parseCalendlyPayload } from "@/lib/calendly/parse-payload";
import { syncBookingToKarbon } from "@/lib/sync-booking";

export const runtime = "nodejs";

/**
 * Calendly signs webhooks as `t=<timestamp>,v1=<signature>` in the
 * Calendly-Webhook-Signature header, computed over `${timestamp}.${rawBody}`.
 * We verify before parsing anything in the body.
 */
function verifyCalendlySignature(
  rawBody: string,
  header: string | null,
  signingKey: string
): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((part) => part.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signingKey = process.env.CALENDLY_SIGNING_KEY;

  if (!signingKey) {
    console.error("CALENDLY_SIGNING_KEY is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const isValid = verifyCalendlySignature(
    rawBody,
    req.headers.get("Calendly-Webhook-Signature"),
    signingKey
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== "invitee.created") {
    // We only act on new bookings for v1. Cancellations/reschedules are a
    // natural v2 addition once the create path is solid.
    return NextResponse.json({ status: "ignored" });
  }

  const booking = parseCalendlyPayload(payload);
  const record = await syncBookingToKarbon(booking);

  return NextResponse.json({ status: record.status, syncId: record.id });
}
