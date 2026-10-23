# Verification — October 23, 2026 (Asia/Kolkata)

Verified locally on macOS Apple Silicon with Python 3.10.11, Node 24.13.0 and npm 11.6.2. No deployment was performed.

## Results

| Check | Actual result |
| --- | --- |
| Local startup | FastAPI on 127.0.0.1:8000 and Vite on 127.0.0.1:5173; both returned successful HTTP responses |
| Import | 21 original CSV tables; four original XLSX workbooks; ready, no import errors |
| Records | 12,000 interactions; 2,200 QA audits; 240 employees; 1,000 enrollments |
| Source traceability | 19 source entries → 13 canonical opportunities; all 19 matched after surrounding-whitespace normalization |
| Source text | 16 exact matches; three QA problem statements differ only in surrounding whitespace; original cells retained |
| Alternatives | 39 source alternatives and 39 source scenario estimates; three for every opportunity |
| Relationships | 27 declared/additional ID-link checks, zero orphan/duplicate-parent violations; contextual program/employee/audit joins consistent |
| Daily reconciliation | Contacts, AHT, FCR, CSAT, SLA, service cost and peak contacts match at documented source rounding precision |
| Typed storage | Numeric/boolean columns preserved; dates stored as DATE, event timestamps as TIMESTAMP; original CSVs unchanged |
| Backend tests | 69 passed (37 existing + 32 agent checks) |
| Frontend tests | 4 passed across 2 files |
| Playwright workflows | 18 passed: all 13 Explore/Run Agent workflows, agent drafts/legacy links/mobile, and the three existing demo regressions |
| TypeScript and production build | Passed; charts/animation/React split into separate chunks; no oversized-chunk warning |
| npm advisory audit | 0 known vulnerabilities reported at verification time |
| Visual checks | Desktop light/dark, scenario comparison, assistant and 390px mobile screenshots inspected |
| Mobile/reduced motion | Navigation and overflow check passed at 390×844; reduced-motion support exercised |
| Real LLM inference | Not tested: no provider/model/key configured; deterministic fallback tested |

Default-period observed metrics: **12,000 interactions**, **84.26 average QA score** across **2,200 audits**, and **77.07% first-contact resolution**. The **13 opportunities** are a catalog count, not operational improvements achieved. Full aggregate validation is recorded in `DATA_VALIDATION.json`.

## AI Agents & Solutions update

The existing application was extended in place. The sidebar and directory now use **AI Agents & Solutions**. Thirteen distinct local rules-based workflows are mapped one-to-one to the original canonical IDs. Every workspace preserves original problem text, worksheet references and exact cells, relevant tables, workflow steps, results/recommendations, and the original solution calculator/action-plan editor.

New backend tests independently check the correct CSV denominators for training, support, sales, product troubleshooting, demand, QA, verification, HR and recognition. They exercise all thirteen workflows in normal and empty scopes, enforce HR access before restricted queries, compare source-file hashes and scenario outputs before/after execution, and forbid provider calls even when provider settings are present. Browser tests open every Explore Agent link and click every Run Agent control. They assert exact original problem text and six sections, meaningful results or a restricted-access limitation, local-only network requests, scope/persona result clearing, named-source legacy redirects, editable plan persistence and mobile overflow.

Cards and workspaces display **AI Agent Demo — Rules-Based**. No new model, provider, cloud service or paid dependency was introduced. Agent runs write only a local audit event. Existing SQLite chats and action plans are retained; browser tests add synthetic drafts/conversations as before.

Screenshots include `ai-agents-solutions.png`, `qa-agent-results.png`, `agent-onboarding-dark.png` and `agents-mobile.png`. The existing service was already running and was reused for validation; it was not shut down or replaced.

## Test coverage

Backend tests independently recompute KPIs from CSVs; check source mappings and all alternatives; validate cost equations, zero adoption and timeline constraints; independently verify paired training dates/sample denominators; exercise REST endpoints and pagination limits; enforce masked HR and chat persona boundaries; reject raw people-table access; verify SQL injection/file-access/write protections; test missing data and archive traversal diagnostics; check provider-output validation using mocked responses; verify explicit-date/program follow-up continuity; validate source-based program filtering; and require named departmental approval before recording an approved plan.

The provider tests mock responses and do not establish real model connectivity or explanation quality. Numeric conclusions remain deterministic. Provider narratives with numbers, invalid citations or unsupported causal/statistical claims are rejected; fallback mode is shown explicitly.

Browser workflows use the actual local APIs and imported dataset:

1. Overview → original requirement → assistant → evidence and alternatives → interactive scenario recalculation → option selection → editable saved draft → Reports.
2. Quality audit drilldown → Training temporal comparison → HR restricted/masked access → dark theme → source mapping → provider-disabled connection test → report download.
3. Program scope → question/follow-up → new/resumed chat → all six spotlight tour steps → 390px reduced-motion view → mobile navigation.

Browser runs create synthetic conversations and draft plans in the local workspace. Repeated runs preserve earlier saved work; unique plan names and scoped chat selectors make tests repeatable.

## Failures found and corrected

- DuckDB reserved alias parsing: replaced implicit `name`/`value` aliases with explicit SQL aliases.
- Onboarding access status: inspected actual source values and used `Provisioned`, avoiding a false all-pending count.
- Initial test-runner advisories: upgraded Vitest to 5.0.5; subsequent npm audit reported no known vulnerabilities.
- Conversation context: retained the selected opportunity and explicit question date range, while honoring changes to global program/date controls.
- Evidence links: knowledge citations now open the correct dictionary inspector; worksheet citations expose preserved originals.
- Source discovery: deduplicated preserved workbook copies and external originals while prioritizing refreshed original/configured inputs.
- Program filtering: retained cross-program QA/Training/HR proposals, while narrowing Customer Operations proposals by actual source program context.
- Startup diagnostics: distinguished occupied ports from sandbox permission errors and allowed normal rapid restarts.
- Tour overlay: raised the spotlight above the action-plan dialog and trapped focus in the uppermost dialog.
- Browser test selectors: used descriptive citation links and unique saved-plan titles so persistent prior test artifacts do not produce ambiguous selectors.
- Chromium initially could not launch under the execution sandbox; approved host execution enabled the requested browser tests. This was an environment restriction, not an application failure.

## Remaining limitations and warnings

- FastAPI/Starlette emits one test-client deprecation warning about its current httpx integration. All backend tests pass with the installed versions.
- Playwright prints the environment's harmless FORCE_COLOR/NO_COLOR warning. Workflow tests pass.
- Production build was compiled/type-checked; browser workflows run against the Vite development server with the real backend, not a separate production hosting configuration.
- Real OpenAI-compatible/Ollama inference, Windows setup, production identity, concurrency at enterprise load, and a measured 60fps performance benchmark were not verified.
- Demo personas are selectable role simulation, not authentication. SQLite triggers provide application-level append-only events, not administrator-resistant audit storage.
- Scenario estimates are unvalidated and assume full-year steady-state operation. Training associations are not causal. No operational system or personnel records are changed.
- No claim of zero bugs is made.

## Commands used

```bash
.venv/bin/python -m pytest backend/tests -q
npm test
npm run build
npm --prefix frontend audit --json
# With npm run dev running:
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/movate-playwright npm --prefix frontend run test:e2e
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/movate-playwright node scripts/screenshots.mjs
```

The custom browser path was used only for this machine's test installation. Other machines can use `npx playwright install chromium` from `frontend/` and run the same tests without that environment variable.
