import express from "express";
import path from "node:path";
import { z } from "zod";
import { createScan, getScan, listScans } from "./database.js";
import { scanUrl } from "./scanner.js";
import { assertSafeUrl, UnsafeUrlError } from "./url-security.js";

const app = express();
const port = Number(process.env.PORT ?? 3100);
const publicDirectory = path.resolve("public");
const scanRequest = z.object({ url: z.string().trim().min(1, "Enter a website URL.") });

app.use(express.json());
app.use(express.static(publicDirectory));

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/scans", (_request, response) => response.json({ scans: listScans() }));
app.get("/api/scans/:id", (request, response) => {
  const scan = getScan(Number(request.params.id));
  if (!scan) return response.status(404).json({ error: "Scan not found." });
  return response.json(scan);
});
app.get("/api/scans/:id/screenshot", (request, response) => {
  const scan = getScan(Number(request.params.id));
  if (!scan?.scan.screenshotPath) return response.status(404).end();
  return response.sendFile(path.resolve(scan.scan.screenshotPath));
});
app.post("/api/scans", async (request, response) => {
  const parsed = scanRequest.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a valid URL." });
  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(parsed.data.url);
  } catch (error) {
    const message = error instanceof UnsafeUrlError ? error.message : "The website could not be safely validated.";
    return response.status(400).json({ error: message });
  }
  const scanId = createScan(safeUrl.toString());
  void scanUrl(scanId, safeUrl.toString());
  return response.status(202).json({ scanId });
});

app.listen(port, () => console.log(`OpenStandard listening on http://localhost:${port}`));
