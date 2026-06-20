/**
 * Calendly sends a fairly deep payload on invitee.created. We only pull out
 * what we need to create a Karbon Contact + Work Item, and we keep the raw
 * payload around in case we need to debug a mismatch later.
 *
 * Calendly webhook signing uses a similar HMAC pattern to Karbon's, via the
 * `Calendly-Webhook-Signature` header — verify it the same way before
 * trusting anything in the body.
 */

import type { IncomingBooking } from "@/types";

interface CalendlyInviteeCreatedPayload {
  event: "invitee.created";
  payload: {
    uri: string;
    email: string;
    name: string;
    text_reminder_number?: string | null;
    questions_and_answers?: { question: string; answer: string }[];
    scheduled_event: {
      uri: string;
      name: string;
      start_time: string;
      end_time: string;
    };
  };
}

export function parseCalendlyPayload(
  payload: CalendlyInviteeCreatedPayload
): IncomingBooking {
  const { payload: invitee } = payload;

  return {
    id: invitee.uri,
    source: "calendly",
    clientName: invitee.name,
    clientEmail: invitee.email,
    clientPhone: invitee.text_reminder_number ?? undefined,
    eventType: invitee.scheduled_event.name,
    startTime: invitee.scheduled_event.start_time,
    endTime: invitee.scheduled_event.end_time,
    notes: invitee.questions_and_answers
      ?.map((qa) => `${qa.question}: ${qa.answer}`)
      .join("\n"),
    raw: payload,
  };
}
