import bcrypt from "bcryptjs";

// 12 rounds is the standard floor for bcrypt in 2026 — fast enough for a
// login request, slow enough to resist offline brute force.
const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
