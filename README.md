# OpenStandard

OpenStandard is an accessibility testing workspace for small web agencies and
product teams. It turns repeatable browser checks into clear, client-ready
reports and practical remediation guidance.

## Planned MVP

- Scan a URL with a real browser
- Run WCAG-oriented automated checks
- Group findings by impact and affected page
- Include reproducible evidence such as selectors and screenshots
- Generate a branded report for clients
- Track findings across scans
- Suggest fixes with links to authoritative guidance

## Current implementation

The first Phase 1 vertical slice is now available:

- Scan a public HTTP or HTTPS URL in a headless Chromium browser
- Run axe-core's documented automated accessibility rules
- Persist scans and findings in a local SQLite database
- Capture a full-page screenshot as reproducible scan evidence
- Group findings by impact and show the affected selector and HTML
- Open the relevant axe-core guidance for each finding
- Install as a standalone desktop or mobile web app from a supported browser

The URL field accepts either a complete address such as
`https://example.com` or a domain such as `example.com`. OpenStandard adds the
secure protocol when it is omitted.

## Local development

Node.js 20 or newer is required.

For the easiest Windows startup, double-click `start-app.bat`, or run:

```powershell
./start-app.ps1
```

The launcher installs npm dependencies and the Chromium browser used by
Playwright when they are not already available, then starts the development
server.

To start the app manually:

```powershell
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:3100`. Scan results are stored in
`./data/openstandard.sqlite` and screenshots are stored in
`./data/screenshots/`.

Automated results are a starting point, not a conformance claim. Keyboard
navigation, focus behaviour, content meaning, zoom, and assistive technology
testing still require human review.
