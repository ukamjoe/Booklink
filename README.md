# BookLink

Syncs new Calendly bookings into Karbon as Contacts + Work Items, so
accounting firms stop manually re-entering appointments into their
practice management system.

Multi-tenant SaaS: anyone can sign up, see a free dashboard, and
subscribe to unlock live syncing. Each firm connects their own Karbon
workspace independently.

## How it works

```
Visitor signs up (email + password)
        │
        ▼
Free dashboard — visible immediately, empty until bookings arrive
        │
        ▼
Settings: paste personal Calendly webhook URL into Calendly,
          connect Karbon credentials
        │
        ▼
Calendly booking created
        │
        ▼
POST /api/webhooks/calendly/[userId]   (signature verified)
        │
        ▼
lib/sync-booking.ts
        │
        ├─ Check subscription status — must be "active" (Stripe webhook
        │  is the only thing that sets this)
        ├─ Karbon: find-or-create Contact by email
        └─ Karbon: create Work Item against that Contact
        │
        ▼
SyncRecord stored in Postgres/SQLite → visible on /dashboard
```

`/api/webhooks/karbon/[userId]` exists but is intentionally thin — it's
there so a future version can reflect Karbon-side changes (e.g. a Work
Item marked complete) back into the dashboard, without committing to
that scope now.

## Routes

| Route | Purpose |
|---|---|
| `/` | Marketing landing page |
| `/signup`, `/login` | Auth |
| `/pricing` | Plan + Stripe Checkout |
| `/dashboard` | Sync ledger (requires login) |
| `/settings` | Connect Karbon, copy webhook URL |

## Setup

1. `npm install` (runs `prisma generate` automatically via postinstall)
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — SQLite file is fine to start
   - Stripe: create a Product called "BookLink" with one recurring monthly
     Price, set `STRIPE_PRICE_ID`. Get `STRIPE_SECRET_KEY` from the Stripe
     dashboard. For `STRIPE_WEBHOOK_SECRET`, either add a webhook endpoint
     in the dashboard pointing at `/api/stripe/webhook`, or run
     `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally.
   - `CALENDLY_SIGNING_KEY` — BookLink's own Calendly developer app's
     signing key (this one is global; it's not the user's Karbon credentials).
3. `npx prisma migrate dev --name init` — creates the local SQLite database
   and tables.
4. `npm run dev`
5. Visit `/` → sign up → `/dashboard` is immediately visible. Subscribe via
   `/pricing` to unlock real syncing, then add Karbon credentials in
   `/settings`.

Each user connects their **own** Karbon account in Settings — there is no
shared/global Karbon credential anymore. This is what makes the app
multi-tenant: register a free developer account per firm at
developers.karbonhq.com.

## Known v1 limitations (by design, not oversight)

- One-way sync only (Calendly → Karbon). Cancellations/reschedules aren't
  handled yet — `invitee.created` is the only event type processed.
- SQLite by default. Fine for early pilots; switch the Prisma datasource
  provider to `postgresql` before scaling past a handful of concurrent
  users, since SQLite doesn't handle concurrent writes well under load.
- No multi-user-per-firm support — one login per Karbon connection, not
  a team with shared access.
- Acuity is in the type system (`BookingSource`) but not wired up yet —
  Calendly was the first integration to validate the core sync logic.
- No password reset flow yet. A locked-out user currently has no
  self-service recovery path.

## Next steps, roughly in order

1. Switch to Postgres before relying on this for real client data.
2. Add password reset (email-based token flow).
3. Add Acuity as a second booking source.
4. Handle `invitee.canceled` so cancellations don't leave orphaned Work Items.
5. Let the firm owner pick which Karbon Work Template to use, instead of
   the hardcoded default.
6. Add retry-from-dashboard for failed syncs.
