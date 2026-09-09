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
- **Playwright's official Planner/Generator/Healer agents** (`.claude/agents/`,
  installed via `npx playwright init-agents --loop=claude`, Playwright 1.56+) — these
  drive a real browser live (via their own `playwright-test` MCP server) to explore
  the app, write a plan, generate the script against verified selectors, and repair
  failures. This replaces hand-driving the general-purpose Playwright MCP server
  ourselves, which is how the first two test cases (TC-52407, TC-52478) were built
  before this pivot — the mechanism is Playwright's own tooling instead, so it isn't
  specific to this one project/app.
- A **dedicated test account** on a **test/QA environment** (never production).
  Credentials via environment variables, never hardcoded into generated scripts or
  committed to the repo.

## High-level flow
1. **Trigger** — ADO service hook (`Work item updated` event) fires on tag changes.
   Webhook receiver does a thin check (tag diff) and enqueues the work item ID for
   async processing — does not process synchronously in the webhook handler.
2. **Pull & store** — fetch the test case via ADO MCP (title, steps, expected
   results, linked requirements). Store the raw work item JSON at
   `test-cases/<id>.json` before doing anything else with it.
3. **Generate** — via Playwright's own agents, not hand-driven MCP calls:
   - **Planner** explores the live app (using `tests/seed.spec.ts` to start from an
     authenticated session) and writes a plan to `specs/tc-<id>-<slug>.md`, grounded
     in real accessibility snapshots — not guessed selectors. When the ADO steps
     don't fully specify test data (e.g. no target value given, or "an existing
     employee" without naming one), the Planner should pick/verify a concrete value
     live and document the rationale in the plan, rather than leaving it ambiguous.
   - **Generator** turns the plan into a spec under `tests/...`, reusing existing
     Page Objects where available (check `/pages` first) and creating new ones
     following the framework convention below when a screen isn't automated yet.
     Note: the Generator agent can only write the one spec file it's asked for — if
     it needs a new Page Object method or test-data file to match project convention,
     that refactor has to be done by hand afterward.
   - **Healer** runs the generated test and repairs failures (bad locators, missing
     navigation, timing issues) until it passes or flags a genuine app defect.
   - One ADO test case maps to one generated test. If the Planner proposes bonus
     scenarios beyond what the ticket documents, don't generate them silently —
     confirm first, since they need their own ADO traceability.
4. **Validate** — lint + typecheck the generated file, then run it once against the
   same test environment before trusting it.
5. **Tag update back to ADO** (state tracking — Option A, tag-based):
   - Generation success → add `Automation-Generated` tag, comment with script
     path/PR link. This means "a script exists and passed once at generation time" —
     it does NOT mean the script is in the regression suite yet (see step 7).
   - Generation failure → add `Automation-Failed` tag, comment with the error, so it
     surfaces for triage instead of retrying silently forever.
   - Steady-state CI run (step 7) success → add `Automation-Verified` tag, comment
     with pass/fail + CI run link. This is deliberately a separate tag from
     `Automation-Generated`, so "generated once" and "currently passing in the real
     regression suite" stay honestly distinguishable — resolving the open question
     from earlier in this project.
   - Steady-state CI run failure → add `Automation-Failed` (same tag as generation
     failure; either way it means "needs human triage").
   - Trigger query must exclude both `Automation-Generated` and `Automation-Failed`
     so processed/failed cases aren't re-picked for *generation*:
     `Tags Contains "Candidate for Automation" AND Tags Does Not Contain
     "Automation-Generated" AND Tags Does Not Contain "Automation-Failed"`.
   - Retry path: removing `Automation-Failed` manually puts the case back in scope.
6. **Human review gate** — generated script goes into a PR, not a direct commit.
   Someone reviews before it joins the real regression suite.
7. **Execution & reporting (steady state)** — once merged, GitHub Actions
   (`.github/workflows/playwright-ci.yml`) runs the full suite on every push to
   `main`. Results are parsed from Playwright's JSON reporter
   (`test-results/results.json`) by `scripts/report-to-ado.mjs`, matched to ADO test
   cases via the `TC-#####` prefix embedded in each test title, and reported back as
   a tag (`Automation-Verified` on pass, `Automation-Failed` on fail) + a comment
   with the run link — the same tag/comment mechanism as generation-time reporting,
   not the full ADO Test Run API (that would give native Test Plans pass-rate
   dashboards but is materially more integration work; revisit if that's needed).
   An Allure report is also generated and uploaded as a GitHub Actions artifact for
   human triage; email delivery was considered but skipped for now (no SMTP/sender
   account set up yet).

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
- **Auth**: use `storageState` set up in `globalSetup` (a one-time login against
  whatever the target app's real auth mechanism is) — do not automate the login
  UI/OAuth redirect per test. (Earlier drafts of this doc assumed a Keycloak OAuth2
  fixture; the actual target app for this project uses plain username/password
  login, so `globalSetup.ts` + `storageState` is what's implemented. If a future
  target app genuinely uses Keycloak/OAuth2, that's a fixture swap, not a framework
  change.)
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

## CI setup required (GitHub Actions)
`.github/workflows/playwright-ci.yml` runs on every push to `main`. It needs these
repository secrets set (Settings → Secrets and variables → Actions) — Claude Code
cannot set these itself (no `gh` CLI/API token in this environment):
- `QA_BASE_URL`, `TEST_USERNAME`, `TEST_PASSWORD` — same values as `.env`.
- `ADO_PAT` — a **raw** Azure DevOps PAT (not base64-encoded, not `email:pat` —
  that specific format is only what the `@azure-devops/mcp` npm package's
  `PERSONAL_ACCESS_TOKEN` env var requires; `scripts/report-to-ado.mjs` calls the
  ADO REST API directly and does its own Basic-auth encoding).

## Open items / not yet decided
- Exact webhook payload handling: ADO's tag-change filtering at the service-hook
  level is unreliable, so the plan is to filter broadly (Work item updated, Work
  Item Type = Test Case) and do the actual tag-diff logic in the receiver code,
  comparing against the previous revision via the ADO REST API if needed.
- Where the agent/orchestrator itself runs long-term (Claude Code is being used for
  local development; production hosting of the async job runner is still open).
- Full ADO Test Run API integration (native Test Plans pass-rate dashboards) was
  considered for step 7 and deferred in favor of the existing tag/comment mechanism
  — revisit if ADO-native reporting views become a real requirement.
- Email delivery of the Allure report was considered and deferred (no SMTP/sender
  account available yet); it's currently a GitHub Actions artifact download only.
