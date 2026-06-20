/**
 * Core domain types for BookLink.
 *
 * The mental model: a Calendly/Acuity booking comes in -> we resolve it to
 * a Karbon Contact (creating one if needed) -> we create a Work Item against
 * that Contact -> we record what happened in a SyncRecord so the dashboard
 * can show the firm owner exactly what synced, what didn't, and why.
 */

export type BookingSource = "calendly" | "acuity";

export interface IncomingBooking {
  id: string; // source-provided booking/event id
  source: BookingSource;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  eventType: string; // e.g. "Tax Review", "Initial Consultation"
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  notes?: string;
  raw: unknown; // original payload, kept for debugging/replay
}

export type SyncStatus = "pending" | "synced" | "failed" | "skipped";

export interface SyncRecord {
  id: string;
  bookingId: string;
  source: BookingSource;
  status: SyncStatus;
  clientName: string;
  eventType: string;
  startTime: string;
  /** Karbon contact key, once resolved or created */
  karbonContactKey?: string;
  /** Karbon work item key, once created */
  karbonWorkItemKey?: string;
  /** Human-readable explanation, especially for "failed" */
  message?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Karbon API shapes (subset relevant to this integration) ---

export interface KarbonContact {
  ContactKey: string;
  FullName: string;
  EmailAddress?: string;
  PhoneNumber?: string;
}

export interface KarbonWorkItemCreateRequest {
  Title: string;
  ClientKey: string;
  ClientType: "Contact" | "Organization" | "ClientGroup";
  StartDate: string; // ISO date
  WorkTemplateKey?: string;
  Description?: string;
}

export interface KarbonWorkItem {
  WorkItemKey: string;
  Title: string;
  ClientKey: string;
  StartDate: string;
}

export interface KarbonWebhookPayload {
  ResourcePermaKey: string;
  ResourceType: "Contact" | "WorkItem" | "Note" | "Organization" | "ClientGroup" | "Estimate";
  ActionType: "Created" | "Updated" | "Deleted";
  Timestamp: string;
}
