/**
 * The core sync pipeline, now per-user and Prisma-backed.
 *
 * Gating: a booking only reaches real Karbon API calls if the user's
 * subscription is active. Anyone can see the dashboard and click around
 * with their own real booking data, but the sync that actually costs
 * Karbon API calls (and proves the value) requires payment. Inactive
 * users get a clearly-labeled "skipped" record explaining why, not a
 * silent no-op.
 */

import { getKarbonClient, KarbonApiError } from "@/lib/karbon/client";
import { prisma } from "@/lib/db/prisma";
import type { IncomingBooking, SyncRecord } from "@/types";

interface SyncOptions {
  workTemplateKey?: string;
}

export async function syncBookingToKarbon(
  userId: string,
  booking: IncomingBooking,
  options: SyncOptions = {}
): Promise<SyncRecord> {
  const existing = await prisma.syncRecord.findUnique({
    where: { userId_bookingId: { userId, bookingId: booking.id } },
  });

  if (existing && existing.status === "synced") {
    // Idempotency: webhook providers redeliver. Don't double-create work items.
    return toSyncRecord(existing);
  }

  const record = existing
    ? await prisma.syncRecord.update({
        where: { id: existing.id },
        data: { status: "pending", message: null },
      })
    : await prisma.syncRecord.create({
        data: {
          userId,
          bookingId: booking.id,
          source: booking.source,
          status: "pending",
          clientName: booking.clientName,
          eventType: booking.eventType,
          startTime: new Date(booking.startTime),
        },
      });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return toSyncRecord(
      await prisma.syncRecord.update({
        where: { id: record.id },
        data: { status: "failed", message: "Account not found" },
      })
    );
  }

  if (user.subscription?.status !== "active") {
    return toSyncRecord(
      await prisma.syncRecord.update({
        where: { id: record.id },
        data: {
          status: "skipped",
          message: "Subscription inactive — booking received but not synced to Karbon",
        },
      })
    );
  }

  if (!user.karbonBearerToken || !user.karbonAccessKey) {
    return toSyncRecord(
      await prisma.syncRecord.update({
        where: { id: record.id },
        data: {
          status: "failed",
          message: "Karbon isn't connected yet — add your API credentials in Settings",
        },
      })
    );
  }

  try {
    const karbon = getKarbonClient({
      bearerToken: user.karbonBearerToken,
      accessKey: user.karbonAccessKey,
    });

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

    return toSyncRecord(
      await prisma.syncRecord.update({
        where: { id: record.id },
        data: {
          status: "synced",
          karbonContactKey: contact.ContactKey,
          karbonWorkItemKey: workItem.WorkItemKey,
          message: null,
        },
      })
    );
  } catch (error) {
    const message =
      error instanceof KarbonApiError
        ? `Karbon error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error during sync";

    return toSyncRecord(
      await prisma.syncRecord.update({
        where: { id: record.id },
        data: { status: "failed", message },
      })
    );
  }
}

// Prisma's generated row shape differs slightly from our API-facing type
// (Date objects vs ISO strings, null vs undefined) — normalize once here
// rather than scattering conversions across callers.
function toSyncRecord(row: {
  id: string;
  bookingId: string;
  source: string;
  status: string;
  clientName: string;
  eventType: string;
  startTime: Date;
  karbonContactKey: string | null;
  karbonWorkItemKey: string | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SyncRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    source: row.source as SyncRecord["source"],
    status: row.status as SyncRecord["status"],
    clientName: row.clientName,
    eventType: row.eventType,
    startTime: row.startTime.toISOString(),
    karbonContactKey: row.karbonContactKey ?? undefined,
    karbonWorkItemKey: row.karbonWorkItemKey ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
