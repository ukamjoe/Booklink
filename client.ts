/**
 * Karbon API client.
 *
 * Auth model (per Karbon developer docs): every request needs TWO headers,
 * not one — this trips people up the first time:
 *   Authorization: Bearer <token issued when your API account was registered>
 *   AccessKey:      <key found in the API app under Connected Apps>
 *
 * Rate limit: 120 requests/minute. On 429, back off using the Retry-After
 * header rather than a fixed delay — Karbon documents this explicitly.
 */

import type {
  KarbonContact,
  KarbonWorkItem,
  KarbonWorkItemCreateRequest,
} from "@/types";

const KARBON_BASE_URL = "https://api.karbonhq.com/v3";

interface KarbonClientConfig {
  bearerToken: string;
  accessKey: string;
}

export class KarbonApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "KarbonApiError";
  }
}

export class KarbonClient {
  private bearerToken: string;
  private accessKey: string;

  constructor(config: KarbonClientConfig) {
    this.bearerToken = config.bearerToken;
    this.accessKey = config.accessKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<T> {
    const res = await fetch(`${KARBON_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.bearerToken}`,
        AccessKey: this.accessKey,
        ...options.headers,
      },
    });

    if (res.status === 429) {
      if (attempt > 3) {
        throw new KarbonApiError("Rate limit exceeded after retries", 429);
      }
      const retryAfterSeconds = Number(res.headers.get("Retry-After")) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return this.request<T>(path, options, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new KarbonApiError(
        `Karbon API request failed: ${res.status} ${res.statusText}`,
        res.status,
        body
      );
    }

    // Some Karbon endpoints (e.g. DELETE) return no body.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /**
   * Find a contact by email. Karbon's Contacts endpoint supports OData-style
   * $filter — we use it rather than pulling every contact and filtering
   * client-side, since firms can have thousands of contacts.
   */
  async findContactByEmail(email: string): Promise<KarbonContact | null> {
    const filter = encodeURIComponent(`EmailAddress eq '${email.replace(/'/g, "''")}'`);
    const result = await this.request<{ value: KarbonContact[] }>(
      `/Contacts?$filter=${filter}`
    );
    return result.value[0] ?? null;
  }

  async createContact(input: {
    fullName: string;
    email: string;
    phone?: string;
  }): Promise<KarbonContact> {
    return this.request<KarbonContact>("/Contacts", {
      method: "POST",
      body: JSON.stringify({
        FullName: input.fullName,
        EmailAddress: input.email,
        PhoneNumber: input.phone,
      }),
    });
  }

  /**
   * Resolve a contact by email, creating one if it doesn't exist yet.
   * This is the core "match or create" step every synced booking goes through.
   */
  async resolveContact(input: {
    fullName: string;
    email: string;
    phone?: string;
  }): Promise<{ contact: KarbonContact; wasCreated: boolean }> {
    const existing = await this.findContactByEmail(input.email);
    if (existing) {
      return { contact: existing, wasCreated: false };
    }
    const created = await this.createContact(input);
    return { contact: created, wasCreated: true };
  }

  async createWorkItem(input: KarbonWorkItemCreateRequest): Promise<KarbonWorkItem> {
    return this.request<KarbonWorkItem>("/WorkItems", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /**
   * Register a webhook subscription so Karbon pushes changes to us instead
   * of us polling. Used during initial app setup, not on every request.
   */
  async createWebhookSubscription(input: {
    targetUrl: string;
    webhookType: string;
    signingKey: string;
  }): Promise<void> {
    await this.request("/WebhookSubscriptions", {
      method: "POST",
      body: JSON.stringify({
        TargetUrl: input.targetUrl,
        WebhookType: input.webhookType,
        SigningKey: input.signingKey,
      }),
    });
  }
}

export function getKarbonClient(): KarbonClient {
  const bearerToken = process.env.KARBON_BEARER_TOKEN;
  const accessKey = process.env.KARBON_ACCESS_KEY;

  if (!bearerToken || !accessKey) {
    throw new Error(
      "Missing Karbon credentials. Set KARBON_BEARER_TOKEN and KARBON_ACCESS_KEY."
    );
  }

  return new KarbonClient({ bearerToken, accessKey });
}
