# AccessLens product overview

## What it is

AccessLens is an accessibility testing workspace for small web agencies and
product teams. It turns repeatable browser checks into clear, client-ready
reports and practical remediation guidance.

## The problem

Small agencies often need to test accessibility but find existing tools too
expensive, too technical for clients, or difficult to use for tracking
improvements over time.

AccessLens focuses on making automated findings understandable and useful for
both developers and clients.

## Proposed workflow

1. Add a website or project.
2. Scan a URL using a real browser.
3. Run automated WCAG-oriented checks.
4. Capture reproducible evidence:
   - Failed rule
   - Affected element
   - CSS selector
   - HTML snippet
   - Screenshot
5. Group results by severity and affected page.
6. Provide practical remediation guidance.
7. Generate a branded client report.
8. Compare results between scans.

## Example findings

- Images missing alternative text
- Poor colour contrast
- Form inputs without labels
- Missing document language
- Incorrect heading structure
- Keyboard navigation issues
- Buttons without accessible names
- Invalid ARIA usage

## MVP scope

The first useful version should include:

- A scan form accepting one URL
- Playwright loading the page
- axe-core running accessibility checks
- Results grouped by impact
- Screenshots of failed elements
- A report page
- HTML export
- Scan history

## Technical direction

- **Frontend:** React or a clean server-rendered interface
- **Backend:** Node.js with TypeScript
- **Browser automation:** Playwright
- **Accessibility engine:** axe-core
- **Database:** SQLite for development, with a path to PostgreSQL
- **Reports:** Accessible HTML first, followed by PDF export
- **Deployment:** Docker and GitHub Actions

## Resume value

AccessLens would demonstrate:

- Browser automation with Playwright
- WCAG and accessibility engineering
- DOM analysis and selector generation
- Screenshot and evidence capture
- Background scan jobs
- Report generation
- Severity and confidence scoring
- Scan history and comparison
- Multi-tenant agency accounts
- Secure URL validation
- Frontend and integration testing
- Continuous integration

## Product principle

Automated accessibility testing cannot prove that a website is fully
accessible. Manual testing is still needed for keyboard usability, screen
reader experience, focus order, content clarity, and complex interactions.

AccessLens should clearly separate automated findings from issues that require
human review. It should report what it can verify without presenting a scan as
an accessibility certification.
