/**
 * The core sync pipeline: takes a normalized booking and ensures Karbon
 * reflects it. This is deliberately a single function with clear steps so
 * failures are easy to attribute to a step when you're staring at the
 * dashboard wondering why a sync failed.
 */

import { randomUUID } from "crypto";
import { getKarbonClient, KarbonApiError } from "@/lib/karbon/client";
import { syncStore } from "@/lib/db/sync-store";
import type { IncomingBooking, SyncRecord } from "@/types";

interface SyncOptions {
  /** Karbon Work Template key to use, if the firm has configured one */
  workTemplateKey?: string;
}

export async function syncBookingToKarbon(
  booking: IncomingBooking,
  options: SyncOptions = {}
): Promise<SyncRecord> {
  const existing = syncStore.getByBookingId(booking.id);
  if (existing && existing.status === "synced") {
    // Idempotency: Calendly/Acuity can redeliver webhooks. Don't double-create.
    return existing;
  }

  const record = syncStore.create({
    id: existing?.id ?? randomUUID(),
    bookingId: booking.id,
    source: booking.source,
    status: "pending",
    clientName: booking.clientName,
    eventType: booking.eventType,
    startTime: booking.startTime,
  });

  try {
    const karbon = getKarbonClient();

    const { contact } = await karbon.resolveContact({
      fullName: booking.clientName,
      email: booking.clientEmail,
      phone: booking.clientPhone,
    });

    const workItem = await karbon.createWorkItem({
      Title: booking.eventType,
      ClientKey: contact.ContactKey,
      ClientType: "Contact",
      StartDate: booking.startTime,
      WorkTemplateKey: options.workTemplateKey,
      Description: booking.notes,
    });

    return (
      syncStore.update(record.id, {
        status: "synced",
        karbonContactKey: contact.ContactKey,
        karbonWorkItemKey: workItem.WorkItemKey,
        message: undefined,
      }) ?? record
    );
  } catch (error) {
    const message =
      error instanceof KarbonApiError
        ? `Karbon error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error during sync";

    return syncStore.update(record.id, { status: "failed", message }) ?? record;
  }
}
