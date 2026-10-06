import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Scan = {
  id: number;
  userId: string | null;
  url: string;
  pageTitle: string;
  status: "running" | "complete" | "failed";
  screenshotPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type AuthSession = {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

export type Finding = {
  id: number;
  scanId: number;
  ruleId: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  description: string;
  helpUrl: string;
  selector: string;
  html: string;
  target: string;
};

const databasePath = process.env.DATABASE_PATH ?? "./data/openstandard.sqlite";
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
export const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES users(id),
    url TEXT NOT NULL,
    page_title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    screenshot_path TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    impact TEXT,
    help TEXT NOT NULL,
    description TEXT NOT NULL,
    help_url TEXT NOT NULL,
    selector TEXT NOT NULL,
    html TEXT NOT NULL,
    target TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const scanColumns = database.prepare("PRAGMA table_info(scans)").all() as Array<{ name: string }>;
if (!scanColumns.some((column) => column.name === "user_id")) {
  database.exec("ALTER TABLE scans ADD COLUMN user_id TEXT REFERENCES users(id)");
}

export function createScan(url: string, userId: string): number {
  const result = database.prepare(
    "INSERT INTO scans (url, user_id, status, created_at) VALUES (?, ?, 'running', ?)"
  ).run(url, userId, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function completeScan(scanId: number, title: string, screenshotPath: string): void {
  database.prepare(
    "UPDATE scans SET page_title = ?, status = 'complete', screenshot_path = ?, completed_at = ? WHERE id = ?"
  ).run(title, screenshotPath, new Date().toISOString(), scanId);
}

export function failScan(scanId: number, message: string): void {
  database.prepare(
    "UPDATE scans SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?"
  ).run(message, new Date().toISOString(), scanId);
}

export function addFinding(scanId: number, finding: Omit<Finding, "id" | "scanId">): void {
  database.prepare(`
    INSERT INTO findings (scan_id, rule_id, impact, help, description, help_url, selector, html, target)
    VALUES (@scanId, @ruleId, @impact, @help, @description, @helpUrl, @selector, @html, @target)
  `).run({ scanId, ...finding });
}

export function getScan(scanId: number, userId?: string): { scan: Scan; findings: Finding[] } | undefined {
  const scan = database.prepare("SELECT id, user_id as userId, url, page_title as pageTitle, status, screenshot_path as screenshotPath, error_message as errorMessage, created_at as createdAt, completed_at as completedAt FROM scans WHERE id = ? AND (? IS NULL OR user_id = ?)").get(scanId, userId ?? null, userId ?? null) as Scan | undefined;
  if (!scan) return undefined;
  const findings = database.prepare("SELECT id, scan_id as scanId, rule_id as ruleId, impact, help, description, help_url as helpUrl, selector, html, target FROM findings WHERE scan_id = ? ORDER BY CASE impact WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3 WHEN 'minor' THEN 4 ELSE 5 END, id").all(scanId) as Finding[];
  return { scan, findings };
}

export function listScans(userId: string): Scan[] {
  return database.prepare("SELECT id, user_id as userId, url, page_title as pageTitle, status, screenshot_path as screenshotPath, error_message as errorMessage, created_at as createdAt, completed_at as completedAt FROM scans WHERE user_id = ? ORDER BY id DESC LIMIT 20").all(userId) as Scan[];
}

export function createUser(user: AuthenticatedUser): AuthenticatedUser {
  database.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (@id, @email, @passwordHash, @createdAt)").run(user);
  return user;
}

export function findUserByEmail(email: string): AuthenticatedUser | undefined {
  return database.prepare("SELECT id, email, password_hash as passwordHash, created_at as createdAt FROM users WHERE email = ?").get(email) as AuthenticatedUser | undefined;
}

export function createSession(session: AuthSession): void {
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (@tokenHash, @userId, @expiresAt, @createdAt)").run(session);
}

export function findUserBySession(tokenHash: string, now: string): AuthenticatedUser | undefined {
  return database.prepare("SELECT u.id, u.email, u.password_hash as passwordHash, u.created_at as createdAt FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?").get(tokenHash, now) as AuthenticatedUser | undefined;
}

export function deleteSession(tokenHash: string): void {
  database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}
