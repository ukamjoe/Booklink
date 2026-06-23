import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const karbonCredentialsSchema = z.object({
  bearerToken: z.string().trim().min(1, "Bearer token is required"),
  accessKey: z.string().trim().min(1, "Access key is required"),
  webhookSigningKey: z
    .string()
    .trim()
    .min(16, "Signing key must be at least 16 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Signing key can only contain letters, numbers, and underscores"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let input;
  try {
    input = karbonCredentialsSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid Karbon credentials" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      karbonBearerToken: input.bearerToken,
      karbonAccessKey: input.accessKey,
      karbonWebhookSigningKey: input.webhookSigningKey,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      karbonBearerToken: null,
      karbonAccessKey: null,
      karbonWebhookSigningKey: null,
    },
  });

  return NextResponse.json({ success: true });
}
