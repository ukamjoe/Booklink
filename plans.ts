/**
 * BookLink pricing decision: one flat subscription, not tiers.
 *
 * Reasoning: the product does one job — sync a booking to Karbon —
 * regardless of whether a firm gets 5 bookings/month or 200. There's no
 * meaningful cost basis for tiering by volume yet (Karbon API calls and
 * Stripe fees don't scale enough at this size to justify the UX friction
 * of making someone pick a tier). Revisit this once real usage data
 * exists; for now, unlimited syncing at one price keeps the buying
 * decision a single yes/no instead of a spreadsheet comparison.
 *
 * The actual Price object lives in the Stripe dashboard — set
 * STRIPE_PRICE_ID to its id once created there (Product: "BookLink",
 * recurring monthly).
 */

export const PLAN = {
  name: "BookLink",
  priceLabel: "$29",
  interval: "month",
  features: [
    "Unlimited Calendly → Karbon syncing",
    "Automatic contact creation in Karbon",
    "Sync dashboard with failure alerts",
    "Email support",
  ],
} as const;

export function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_ID environment variable.");
  }
  return priceId;
}
