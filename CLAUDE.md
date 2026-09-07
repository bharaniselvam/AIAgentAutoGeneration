# ADO → Playwright Automation Agent

## Purpose
This project builds an agent that watches Azure DevOps (ADO) for test cases tagged
`Candidate for Automation`, generates Playwright (TypeScript) automation scripts for
them by driving the real application, executes the scripts, and reports results back
to ADO — with ADO itself used as the source of truth for pipeline state (no separate
tracking DB).

Previously attempted with GitHub Copilot and failed — Copilot generated scripts from
the test case description alone with no live view of the application, so selectors
were hallucinated and there was no execution feedback loop. This project is designed
specifically to avoid that failure mode by giving the agent live browser access via
Playwright MCP, not just text-based generation.

## Tools required
- **ADO MCP server** — read work items, add/remove tags, add comments, update fields.
- **Playwright MCP server** (`@playwright/mcp`) — drive a real browser: navigate,
  click, fill, read accessibility snapshots. This is what grounds script generation
  in the real app instead of hallucinated selectors.
- A **dedicated test account** on a **test/QA environment** (never production).
  Credentials via environment variables, never hardcoded into generated scripts or
  committed to the repo.

## High-level flow
1. **Trigger** — ADO service hook (`Work item updated` event) fires on tag changes.
   Webhook receiver does a thin check (tag diff) and enqueues the work item ID for
   async processing — does not process synchronously in the webhook handler.
2. **Pull & store** — fetch the test case via ADO MCP (title, steps, expected
   results, linked requirements). Store as structured JSON.
3. **Generate** — agent uses Playwright MCP to log into the test environment, walk
   the ADO steps live in the browser, and capture real locators from accessibility
   snapshots (`getByRole`, `getByLabel`, `getByTestId`) — not guessed CSS selectors.
   Reuses existing Page Objects where available; creates new ones following the
   framework convention below when a screen isn't automated yet.
4. **Validate** — lint + typecheck the generated file, then run it once against the
   same test environment before trusting it.
5. **Tag update back to ADO** (state tracking — Option A, tag-based):
   - Success → add `Automation-Generated` tag, comment with script path/PR link.
   - Failure → add `Automation-Failed` tag, comment with the error, so it surfaces
     for triage instead of retrying silently forever.
   - Trigger query must exclude both tags so processed/failed cases aren't re-picked:
     `Tags Contains "Candidate for Automation" AND Tags Does Not Contain
     "Automation-Generated" AND Tags Does Not Contain "Automation-Failed"`.
   - Retry path: removing `Automation-Failed` manually puts the case back in scope.
6. **Human review gate** — generated script goes into a PR, not a direct commit.
   Someone reviews before it joins the real regression suite.
7. **Execution & reporting (steady state)** — once merged, script runs in normal CI.
   Results parsed from Playwright's JSON reporter and pushed to ADO Test Run API.

## Build order (do not skip ahead)
Build and validate end-to-end on **one real test case, run manually**, before wiring
up the webhook trigger. Automating an unreliable pipeline just automates the
unreliability.

1. Confirm ADO MCP + Playwright MCP are connected; test account + test env ready.
2. Stand up the webhook receiver (thin: tag-diff check → enqueue → 200 OK). Build
   last — see step 10.
3. Hand-run ONE test case through steps 4–9 manually first.
4. Pull & store logic.
5. Generation logic (live browser walk-through).
6. Validation (lint/typecheck/first run).
7. Tag update back to ADO.
8. PR-based human review gate.
9. Steady-state execution + results reporting.
10. Only once 4–9 work reliably on a few real test cases, connect the webhook
    trigger from step 2.

## Playwright framework conventions (generated scripts must follow these)

```
/tests
  /ui
    /well-search
      well-search.spec.ts
    /drilling-ops
  /api
    kick-tolerance.spec.ts
/pages                       ← Page Object Model
  base.page.ts
  login.page.ts
  well-search.page.ts
/fixtures
  auth.fixture.ts             ← Keycloak token / logged-in session fixture
  test-data.fixture.ts
/utils
  getAuthenticationToken.ts    ← existing reusable Keycloak OAuth2 helper
  api-client.ts
/config
  environments.ts              ← per-env base URLs + known-good test data
/test-data
  well-search.data.json
playwright.config.ts
.env / .env.example
```

- **Locators**: prefer `getByRole`, `getByLabel`, `getByTestId` from captured
  accessibility snapshots. Avoid brittle CSS/XPath selectors.
- **POM reuse**: check `/pages` for an existing Page Object for the target screen
  before generating a new one. Extend `BasePage`.
- **Auth**: use the `authenticatedPage` fixture (built on `getAuthenticationToken`,
  Keycloak realm `DecisionSpace_Integration_Server`) or `storageState` set up in
  `globalSetup` — do not automate the login UI/OAuth redirect per test.
- **Test data**: resolve from `/config/environments.ts` or `/test-data/*.json` per
  environment — never hardcode values that will break on environment refresh.
- **Traceability**: embed the ADO test case ID in the test title, e.g.
  `test('TC-4521: Search well by name returns matching results', ...)`.
- **Config**: `playwright.config.ts` uses `projects` per environment (dev/qa/staging),
  and `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`,
  `video: 'retain-on-failure'` for triage. Reporters: `html` + `json` (JSON output
  is what gets parsed for ADO result reporting).

## ADO connection details
- Organization: `iLink-Digital`
- Project: `Benefit Plans`
- Test plan: `Benefit Reg Test plan`
- Base REST API URL: `https://dev.azure.com/iLink-Digital/Benefit%20Plans/_apis`
- MCP server: local `@azure-devops/mcp` (stdio, PAT auth) — configured in `.mcp.json`.
  The remote hosted server (`https://mcp.dev.azure.com/{org}`) was considered but
  requires a Microsoft Entra app registration + admin consent for Claude Code, so
  the local PAT-based server was chosen instead to avoid depending on tenant admin
  availability. `PERSONAL_ACCESS_TOKEN` (base64 of `email:pat`) is set as a Windows
  User environment variable, not committed to any file in the repo.

## Open items / not yet decided
- Exact webhook payload handling: ADO's tag-change filtering at the service-hook
  level is unreliable, so the plan is to filter broadly (Work item updated, Work
  Item Type = Test Case) and do the actual tag-diff logic in the receiver code,
  comparing against the previous revision via the ADO REST API if needed.
- Where the agent/orchestrator itself runs long-term (Claude Code is being used for
  local development; production hosting of the async job runner is still open).
- Whether to add a further `Automation-Verified` tag (script also passed at least
  one real run) as distinct from `Automation-Generated` (script exists, passed
  static validation) — leaning toward keeping these separate for honesty about
  state.
