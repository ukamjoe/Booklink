# BookLink

Syncs new Calendly bookings into Karbon as Contacts + Work Items, so
accounting firms stop manually re-entering appointments into their
practice management system.

## How it works

```
Calendly booking created
        │
        ▼
POST /api/webhooks/calendly   (signature verified)
        │
        ▼
lib/sync-booking.ts
        │
        ├─ Karbon: find-or-create Contact by email
        └─ Karbon: create Work Item against that Contact
        │
        ▼
SyncRecord stored → visible on /dashboard
```

`/api/webhooks/karbon` exists but is intentionally thin — it's there so a
future version can reflect Karbon-side changes (e.g. a Work Item marked
complete) back into the dashboard, without committing to that scope now.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - Karbon: request a free developer account at https://developers.karbonhq.com/,
     then find your Bearer token + AccessKey under your Karbon account's
     Connected Apps.
   - Calendly: create a webhook subscription for `invitee.created` pointing
     at `https://<your-domain>/api/webhooks/calendly`, and copy the signing
     key Calendly gives you.
3. `npm run dev`
4. Visit `/dashboard` — empty until the first webhook arrives.

## Known v1 limitations (by design, not oversight)

- One-way sync only (Calendly → Karbon). Cancellations/reschedules aren't
  handled yet — `invitee.created` is the only event type processed.
- In-memory store (`lib/db/sync-store.ts`). Fine for local dev and early
  pilots; swap for Postgres before relying on this for real client data,
  since records won't survive a server restart.
- No multi-tenant support — one Karbon connection per deployment. Adding
  multiple firms means adding an account/workspace layer before this can
  be sold as multi-tenant SaaS.
- Acuity is in the type system (`BookingSource`) but not wired up yet —
  Calendly was the first integration to validate the core sync logic.

## Next steps, roughly in order

1. Wire up a real database for `syncStore`.
2. Add Acuity as a second booking source.
3. Handle `invitee.canceled` so cancellations don't leave orphaned Work Items.
4. Let the firm owner pick which Karbon Work Template to use, instead of
   the hardcoded default.
5. Add retry-from-dashboard for failed syncs, so a fixed bad email doesn't
   require re-triggering the webhook.
