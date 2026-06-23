import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/plans";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription) {
    // Shouldn't happen — every user gets a Subscription row at signup —
    // but fail loudly rather than silently creating an orphaned Stripe
    // customer if this invariant is ever broken.
    return NextResponse.json(
      { error: "No billing record found for this account" },
      { status: 500 }
    );
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_URL;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: subscription.stripeCustomerId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=canceled`,
    client_reference_id: user.id,
    metadata: { userId: user.id },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create checkout session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
