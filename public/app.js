const form = document.querySelector("#scan-form");
const message = document.querySelector("#form-message");
const scansElement = document.querySelector("#scans");
const reportElement = document.querySelector("#report");
const scanCount = document.querySelector("#scan-count");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

async function loadScans() {
  const response = await fetch("/api/scans");
  const { scans } = await response.json();
  scanCount.textContent = scans.length ? `${scans.length} recent` : "";
  scansElement.innerHTML = scans.length ? scans.map((scan) => `<article class="scan-card"><div><a href="#report" data-scan-id="${scan.id}">${escapeHtml(scan.pageTitle || scan.url)}</a><div class="scan-meta">${escapeHtml(scan.url)} · ${formatDate(scan.createdAt)}</div></div><span class="status ${scan.status}">${scan.status === "complete" ? "Complete" : escapeHtml(scan.status)}</span></article>`).join("") : '<div class="empty">Your completed scans will appear here.</div>';
  document.querySelectorAll("[data-scan-id]").forEach((link) => link.addEventListener("click", () => showReport(link.dataset.scanId)));
}

async function showReport(id) {
  const response = await fetch(`/api/scans/${id}`);
  const { scan, findings } = await response.json();
  const counts = ["critical", "serious", "moderate", "minor"].map((impact) => [impact, findings.filter((finding) => finding.impact === impact).length]);
  reportElement.hidden = false;
  reportElement.innerHTML = `<div class="report-head"><div><p class="eyebrow">Scan report</p><h2>${escapeHtml(scan.pageTitle || "Untitled page")}</h2><p class="report-url">${escapeHtml(scan.url)} · ${formatDate(scan.completedAt || scan.createdAt)}</p></div>${scan.screenshotPath ? `<a href="/api/scans/${scan.id}/screenshot" target="_blank" rel="noreferrer">View screenshot</a>` : ""}</div><div class="summary"><div class="metric"><strong>${findings.length}</strong><span>Findings</span></div>${counts.map(([impact, count]) => `<div class="metric"><strong>${count}</strong><span>${impact[0].toUpperCase() + impact.slice(1)}</span></div>`).join("")}</div><h3>${findings.length ? "Prioritised findings" : "No automated violations found"}</h3>${findings.length ? findings.map((finding) => `<article class="finding ${finding.impact || ""}"><h3>${escapeHtml(finding.help)}</h3><p>${escapeHtml(finding.description)}</p><code>${escapeHtml(finding.selector)}\n${escapeHtml(finding.html)}</code><p><a href="${escapeHtml(finding.helpUrl)}" target="_blank" rel="noreferrer">Read the relevant guidance →</a></p></article>`).join("") : '<p class="muted">axe-core did not identify violations in the checks that ran. Manual review is still important for keyboard use, focus order, content meaning, and other human-centred checks.</p>'}`;
  reportElement.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  message.textContent = "Loading the page and running checks…";
  try {
    const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: new FormData(form).get("url") }) });
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

loadScans();
