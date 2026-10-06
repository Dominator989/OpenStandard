import express from "express";
import path from "node:path";
import { z } from "zod";
import { createScan, getScan, listScans } from "./database.js";
import { scanUrl } from "./scanner.js";
import { assertSafeUrl, UnsafeUrlError } from "./url-security.js";
import { authenticateSession, loginUser, logoutUser, registerUser } from "./auth.js";

const app = express();
const port = Number(process.env.PORT ?? 3100);
const publicDirectory = path.resolve("public");
const scanRequest = z.object({ url: z.string().trim().min(1, "Enter a website URL.") });
const authRequest = z.object({ email: z.string(), password: z.string() });
const sessionCookieName = "openstandard_session";

app.use(express.json());
app.use(express.static(publicDirectory));

function readCookie(request: express.Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}

function setSessionCookie(response: express.Response, token: string): void {
  response.setHeader("Cache-Control", "no-store");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
}

function clearSessionCookie(response: express.Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Set-Cookie", `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function requireUser(request: express.Request, response: express.Response) {
  const user = authenticateSession(readCookie(request, sessionCookieName));
  if (!user) {
    response.status(401).json({ error: "Sign in to access your scan workspace." });
    return undefined;
  }
  return user;
}

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/auth/me", (request, response) => response.json({ user: authenticateSession(readCookie(request, sessionCookieName)) ?? null }));
app.post("/api/auth/register", (request, response) => {
  const parsed = authRequest.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Enter an email and password." });
  try {
    const result = registerUser(parsed.data.email, parsed.data.password);
    setSessionCookie(response, result.token);
    return response.status(201).json({ user: result.user });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Unable to create your account." });
  }
});
app.post("/api/auth/login", (request, response) => {
  const parsed = authRequest.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Enter an email and password." });
  try {
    const result = loginUser(parsed.data.email, parsed.data.password);
    setSessionCookie(response, result.token);
    return response.json({ user: result.user });
  } catch (error) {
    return response.status(401).json({ error: error instanceof Error ? error.message : "Unable to sign in." });
  }
});
app.post("/api/auth/logout", (request, response) => {
  logoutUser(readCookie(request, sessionCookieName));
  clearSessionCookie(response);
  return response.status(204).end();
});
app.get("/api/scans", (request, response) => {
  const user = requireUser(request, response);
  if (!user) return;
  return response.json({ scans: listScans(user.id) });
});
app.get("/api/scans/:id", (request, response) => {
  const user = requireUser(request, response);
  if (!user) return;
  const scan = getScan(Number(request.params.id), user.id);
  if (!scan) return response.status(404).json({ error: "Scan not found." });
  return response.json(scan);
});
app.get("/api/scans/:id/screenshot", (request, response) => {
  const user = requireUser(request, response);
  if (!user) return;
  const scan = getScan(Number(request.params.id), user.id);
  if (!scan?.scan.screenshotPath) return response.status(404).end();
  return response.sendFile(path.resolve(scan.scan.screenshotPath));
});
app.post("/api/scans", async (request, response) => {
  const user = requireUser(request, response);
  if (!user) return;
  const parsed = scanRequest.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a valid URL." });
  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(parsed.data.url);
  } catch (error) {
    const message = error instanceof UnsafeUrlError ? error.message : "The website could not be safely validated.";
    return response.status(400).json({ error: message });
  }
  const scanId = createScan(safeUrl.toString(), user.id);
  void scanUrl(scanId, safeUrl.toString());
  return response.status(202).json({ scanId });
});

app.listen(port, () => console.log(`OpenStandard listening on http://localhost:${port}`));
