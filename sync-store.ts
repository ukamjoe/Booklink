/**
 * Storage for SyncRecords — the dashboard's source of truth for "what
 * happened to each booking."
 *
 * This is intentionally minimal for the MVP: an in-memory store that's
 * easy to swap for Postgres/SQLite once you have real users. Don't reach
 * for an ORM yet — the shape is simple enough that a real database can
 * slot in later by reimplementing this exact interface.
 */

import type { SyncRecord, SyncStatus } from "@/types";

class SyncStore {
  private records = new Map<string, SyncRecord>();

  create(record: Omit<SyncRecord, "createdAt" | "updatedAt">): SyncRecord {
    const now = new Date().toISOString();
    const full: SyncRecord = { ...record, createdAt: now, updatedAt: now };
    this.records.set(full.id, full);
    return full;
  }

  update(id: string, patch: Partial<SyncRecord>): SyncRecord | null {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated: SyncRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return updated;
  }

  updateStatus(id: string, status: SyncStatus, message?: string): SyncRecord | null {
    return this.update(id, { status, message });
  }

  getAll(): SyncRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getByBookingId(bookingId: string): SyncRecord | null {
    return (
      Array.from(this.records.values()).find((r) => r.bookingId === bookingId) ?? null
    );
  }
}

// Module-level singleton. In a serverless deployment this resets per
// instance — fine for local dev, but swap for a real database before
// deploying to production so records survive across function invocations.
export const syncStore = new SyncStore();
