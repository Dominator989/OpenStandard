import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Scan = {
  id: number;
  url: string;
  pageTitle: string;
  status: "running" | "complete" | "failed";
  screenshotPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
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

const databasePath = process.env.DATABASE_PATH ?? "./data/accesslens.sqlite";
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
export const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
`);

export function createScan(url: string): number {
  const result = database.prepare(
    "INSERT INTO scans (url, status, created_at) VALUES (?, 'running', ?)"
  ).run(url, new Date().toISOString());
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

export function getScan(scanId: number): { scan: Scan; findings: Finding[] } | undefined {
  const scan = database.prepare("SELECT id, url, page_title as pageTitle, status, screenshot_path as screenshotPath, error_message as errorMessage, created_at as createdAt, completed_at as completedAt FROM scans WHERE id = ?").get(scanId) as Scan | undefined;
  if (!scan) return undefined;
  const findings = database.prepare("SELECT id, scan_id as scanId, rule_id as ruleId, impact, help, description, help_url as helpUrl, selector, html, target FROM findings WHERE scan_id = ? ORDER BY CASE impact WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3 WHEN 'minor' THEN 4 ELSE 5 END, id").all(scanId) as Finding[];
  return { scan, findings };
}

export function listScans(): Scan[] {
  return database.prepare("SELECT id, url, page_title as pageTitle, status, screenshot_path as screenshotPath, error_message as errorMessage, created_at as createdAt, completed_at as completedAt FROM scans ORDER BY id DESC LIMIT 20").all() as Scan[];
}
