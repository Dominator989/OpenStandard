import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createUser, createSession, deleteSession, findUserByEmail, findUserBySession, type AuthenticatedUser } from "./database.js";

export type PublicUser = Pick<AuthenticatedUser, "id" | "email" | "createdAt">;

const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function publicUser(user: AuthenticatedUser): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export function registerUser(email: string, password: string): { user: PublicUser; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
  if (findUserByEmail(normalizedEmail)) throw new Error("An account with that email already exists.");
  const user = createUser({
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  });
  return { user: publicUser(user), token: createAuthSession(user.id) };
}

export function loginUser(email: string, password: string): { user: PublicUser; token: string } {
  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error("Invalid email or password.");
  return { user: publicUser(user), token: createAuthSession(user.id) };
}

export function authenticateSession(token: string | undefined): PublicUser | undefined {
  if (!token) return undefined;
  const user = findUserBySession(hashToken(token), new Date().toISOString());
  return user ? publicUser(user) : undefined;
}

export function logoutUser(token: string | undefined): void {
  if (token) deleteSession(hashToken(token));
}

function createAuthSession(userId: string): string {
  const token = randomBytes(32).toString("base64url");
  createSession({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + sessionDurationMs).toISOString(),
    createdAt: new Date().toISOString()
  });
  return token;
}
