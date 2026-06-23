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

### Deploying to Vercel (production)

1. Push this repo to GitHub (already done if you're reading this from there) and import it into a new Vercel project.
2. In the Vercel project dashboard: **Storage → Create Database → Postgres**. This provisions a free Neon-backed Postgres database and automatically sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` as project environment variables — you don't need to type these in by hand.
3. In **Project Settings → Environment Variables**, add the rest:
   - `NEXT_PUBLIC_URL` — your Vercel deployment URL (e.g. `https://booklink.vercel.app`)
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — see below
   - `CALENDLY_SIGNING_KEY` — see below
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy), or just push a new commit. The build now runs `prisma migrate deploy` automatically before building, which creates all the database tables on first deploy.
5. Visit your deployment URL. You should see the landing page, not a downloaded file. If you still see a download, check the build logs in Vercel for the actual error — it almost always means an environment variable above is missing or misspelled.

### Local development

1. `npm install` (runs `prisma generate` automatically via postinstall)
2. Pull the real Postgres env vars Vercel created: `npx vercel link` then `npx vercel env pull .env.local`
   - Alternatively, copy `.env.example` to `.env.local` and fill in a Postgres connection string yourself (e.g. from a free Neon project at neon.tech).
3. `npx prisma migrate dev --name init` — only needed once, or after schema changes, for local development.
4. Fill in the rest of `.env.local`:
   - Stripe: create a Product called "BookLink" with one recurring monthly Price, set `STRIPE_PRICE_ID`. Get `STRIPE_SECRET_KEY` from the Stripe dashboard. For `STRIPE_WEBHOOK_SECRET`, either add a webhook endpoint in the dashboard pointing at `/api/stripe/webhook`, or run `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally.
   - `CALENDLY_SIGNING_KEY` — BookLink's own Calendly developer app's signing key (this one is global; it's not the user's Karbon credentials).
5. `npm run dev`
6. Visit `/` → sign up → `/dashboard` is immediately visible. Subscribe via `/pricing` to unlock real syncing, then add Karbon credentials in `/settings`.

Each user connects their **own** Karbon account in Settings — there is no
shared/global Karbon credential anymore. This is what makes the app
multi-tenant: register a free developer account per firm at
developers.karbonhq.com.

## Known v1 limitations (by design, not oversight)

- One-way sync only (Calendly → Karbon). Cancellations/reschedules aren't
  handled yet — `invitee.created` is the only event type processed.
- No multi-user-per-firm support — one login per Karbon connection, not
  a team with shared access.
- Acuity is in the type system (`BookingSource`) but not wired up yet —
  Calendly was the first integration to validate the core sync logic.
- No password reset flow yet. A locked-out user currently has no
  self-service recovery path.

## Next steps, roughly in order

1. Add password reset (email-based token flow).
2. Add Acuity as a second booking source.
3. Handle `invitee.canceled` so cancellations don't leave orphaned Work Items.
4. Let the firm owner pick which Karbon Work Template to use, instead of
   the hardcoded default.
5. Add retry-from-dashboard for failed syncs.
