const form = document.querySelector("#scan-form");
const message = document.querySelector("#form-message");
const scansElement = document.querySelector("#scans");
const reportElement = document.querySelector("#report");
const scanCount = document.querySelector("#scan-count");
const installButton = document.querySelector("#install-app");
const authPanel = document.querySelector("#auth-panel");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const accountSummary = document.querySelector("#account-summary");
const logoutButton = document.querySelector("#logout-button");
const authTabs = document.querySelectorAll("[data-auth-mode]");
let authMode = "login";
let installPrompt;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const impactOrder = ["critical", "serious", "moderate", "minor"];
const impactLabel = (impact) => impact ? impact[0].toUpperCase() + impact.slice(1) : "Review";
const unique = (values) => [...new Set(values)];

async function loadScans() {
  const response = await fetch("/api/scans");
  const { scans } = await response.json();
  scanCount.textContent = scans.length ? `${scans.length} recent` : "";
  scansElement.innerHTML = scans.length ? scans.map((scan) => `<article class="scan-card"><div><a href="#report" data-scan-id="${scan.id}">${escapeHtml(scan.pageTitle || scan.url)}</a><div class="scan-meta">${escapeHtml(scan.url)} · ${formatDate(scan.createdAt)}</div></div><span class="status ${scan.status}">${scan.status === "complete" ? "Complete" : escapeHtml(scan.status)}</span></article>`).join("") : '<div class="empty">Your completed scans will appear here.</div>';
  document.querySelectorAll("[data-scan-id]").forEach((link) => link.addEventListener("click", () => showReport(link.dataset.scanId)));
}

function setAuthenticatedUser(user) {
  const signedIn = Boolean(user);
  authPanel.hidden = signedIn;
  form.hidden = !signedIn;
  accountSummary.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  if (signedIn) accountSummary.textContent = user.email;
}

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me");
  const { user } = await response.json();
  setAuthenticatedUser(user);
  if (user) await loadScans();
}

async function showReport(id) {
  const response = await fetch(`/api/scans/${id}`);
  const { scan, findings } = await response.json();
  const counts = impactOrder.map((impact) => [impact, findings.filter((finding) => finding.impact === impact).length]);
  const ruleCount = unique(findings.map((finding) => finding.ruleId)).length;
  const affectedElementCount = findings.length;
  const groupedFindings = findings.reduce((groups, finding) => {
    const existing = groups.find((group) => group.ruleId === finding.ruleId);
    if (existing) existing.nodes.push(finding);
    else groups.push({ ...finding, nodes: [finding] });
    return groups;
  }, []);
  reportElement.hidden = false;
  reportElement.innerHTML = `<div class="report-head"><div><p class="eyebrow">Accessibility report</p><h2>${escapeHtml(scan.pageTitle || "Untitled page")}</h2><p class="report-url">${escapeHtml(scan.url)} · Scanned ${formatDate(scan.completedAt || scan.createdAt)}</p></div><div class="report-actions">${scan.screenshotPath ? `<a class="report-action" href="/api/scans/${scan.id}/screenshot" target="_blank" rel="noreferrer">View screenshot</a>` : ""}<button class="report-action report-action-button" type="button" id="print-report">Print report</button></div></div><div class="report-overview"><div><p class="eyebrow">Automated overview</p><h3>${findings.length ? `${findings.length} issue${findings.length === 1 ? "" : "s"} need attention` : "No automated violations found"}</h3><p class="muted">${ruleCount} rule${ruleCount === 1 ? "" : "s"} flagged across ${affectedElementCount} affected element${affectedElementCount === 1 ? "" : "s"}. Automated checks are evidence for review, not a conformance claim.</p></div><div class="report-status ${findings.length ? "needs-attention" : "clear"}">${findings.length ? "Needs attention" : "No violations found"}</div></div><div class="summary"><div class="metric metric-total"><strong>${findings.length}</strong><span>Affected elements</span></div>${counts.map(([impact, count]) => `<div class="metric metric-${impact}"><strong>${count}</strong><span>${impactLabel(impact)}</span></div>`).join("")}</div><div class="report-section-heading"><div><p class="eyebrow">Prioritised findings</p><h3>${findings.length ? "Resolve the highest-impact issues first" : "Automated checks are clear"}</h3></div></div>${findings.length ? groupedFindings.map((finding) => `<article class="finding ${finding.impact || ""}"><div class="finding-heading"><div><span class="severity ${finding.impact || "review"}">${impactLabel(finding.impact)}</span><h3>${escapeHtml(finding.help)}</h3></div><span class="affected-count">${finding.nodes.length} affected</span></div><p>${escapeHtml(finding.description)}</p><details><summary>View affected elements</summary>${finding.nodes.map((node) => `<div class="node"><code>${escapeHtml(node.selector)}\n${escapeHtml(node.html)}</code></div>`).join("")}</details><p><a href="${escapeHtml(finding.helpUrl)}" target="_blank" rel="noreferrer">Read the relevant guidance →</a></p></article>`).join("") : '<p class="empty report-empty">axe-core did not identify violations in the checks that ran. Continue with the manual review prompts below.</p>'}<div class="manual-review"><div><p class="eyebrow">Human review</p><h3>Checks that automation cannot verify</h3><p class="muted">Use these prompts before sharing this report with a client or calling a page accessible.</p></div><ul><li><span class="check-icon">01</span><div><strong>Keyboard flow</strong><span>Can every interactive element be reached and used without a mouse?</span></div></li><li><span class="check-icon">02</span><div><strong>Focus visibility</strong><span>Is the current focus clear, visible, and in a logical order?</span></div></li><li><span class="check-icon">03</span><div><strong>Content and context</strong><span>Do headings, links, labels, and instructions make sense when read aloud?</span></div></li><li><span class="check-icon">04</span><div><strong>Zoom and reflow</strong><span>Does the page remain usable at 200% zoom and on a narrow viewport?</span></div></li></ul></div>`;
  document.querySelector("#print-report").addEventListener("click", () => window.print());
  reportElement.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  const urlInput = document.querySelector("#url");
  const enteredUrl = urlInput.value.trim();
  if (!enteredUrl) {
    message.textContent = "Enter a website address to scan.";
    urlInput.focus();
    return;
  }
  const normalizedUrl = /^https?:\/\//i.test(enteredUrl) ? enteredUrl : `https://${enteredUrl}`;
  try {
    new URL(normalizedUrl);
  } catch {
    message.textContent = "Enter a valid website address, such as example.com.";
    urlInput.focus();
    return;
  }
  button.disabled = true;
  message.textContent = "Loading the page and running checks…";
  try {
    const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: normalizedUrl }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The scan could not be started.");
    message.textContent = "Scan started. This page will update when the report is ready.";
    const poll = async () => {
      const scanResponse = await fetch(`/api/scans/${result.scanId}`);
      const scanResult = await scanResponse.json();
      if (scanResult.scan.status === "running") return setTimeout(poll, 1200);
      await loadScans();
      message.textContent = scanResult.scan.status === "complete" ? "Scan complete." : `Scan failed: ${scanResult.scan.errorMessage}`;
      if (scanResult.scan.status === "complete") showReport(result.scanId);
      button.disabled = false;
    };
    poll();
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

authTabs.forEach((tab) => tab.addEventListener("click", () => {
  authMode = tab.dataset.authMode;
  authTabs.forEach((item) => item.classList.toggle("active", item === tab));
  authForm.querySelector(".auth-submit").innerHTML = authMode === "login" ? 'Sign in <span aria-hidden="true">→</span>' : 'Create account <span aria-hidden="true">→</span>';
  document.querySelector("#auth-password").autocomplete = authMode === "login" ? "current-password" : "new-password";
  authMessage.textContent = "";
}));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = authForm.querySelector("button[type=submit]");
  button.disabled = true;
  authMessage.textContent = authMode === "login" ? "Signing you in…" : "Creating your workspace…";
  try {
    const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.querySelector("#auth-email").value, password: document.querySelector("#auth-password").value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Authentication failed.");
    authForm.reset();
    authMessage.textContent = "Your workspace is ready.";
    setAuthenticatedUser(result.user);
    await loadScans();
  } catch (error) {
    authMessage.textContent = error instanceof Error ? error.message : "Authentication failed.";
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  reportElement.hidden = true;
  setAuthenticatedUser(null);
  scansElement.innerHTML = '<div class="empty">Sign in to see your saved scans.</div>';
  scanCount.textContent = "";
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
loadCurrentUser();
