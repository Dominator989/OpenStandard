import axe from "axe-core";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { addFinding, completeScan, failScan } from "./database.js";

const screenshotDirectory = path.resolve("data/screenshots");

export async function scanUrl(scanId: number, url: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const title = await page.title();
    const result = await page.evaluate(async (source) => {
      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
      return (window as typeof window & { axe: typeof import("axe-core") }).axe.run(document);
    }, axe.source);
    await fs.mkdir(screenshotDirectory, { recursive: true });
    const screenshotPath = path.join(screenshotDirectory, `${scanId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        addFinding(scanId, {
          ruleId: violation.id,
          impact: violation.impact ?? null,
          help: violation.help,
          description: violation.description,
          helpUrl: violation.helpUrl,
          selector: node.target.join(", "),
          html: node.html,
          target: node.target.join(" > ")
        });
      }
    }
    completeScan(scanId, title, screenshotPath);
  } catch (error) {
    failScan(scanId, error instanceof Error ? error.message : "The scan failed.");
  } finally {
    await browser.close();
  }
}
