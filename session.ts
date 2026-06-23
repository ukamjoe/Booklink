import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE = "booklink_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * We store sessions in the database (not just signed cookies) so they can
 * be revoked server-side — e.g. if a Stripe webhook ever needs to force a
 * logout, or a user wants "log out everywhere."  The cookie only holds an
 * opaque, unguessable session ID; nothing else.
 */
export async function createSession(userId: string): Promise<void> {
  const session = await prisma.session.create({
    data: {
      id: randomBytes(32).toString("hex"),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {
      // Session already gone — fine, nothing to clean up.
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}
