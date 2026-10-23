# AI Agents & Solutions

This is an in-place extension of Movate AI Operations Intelligence. All 13 canonical opportunity IDs, 19 original source references, exact workbook cells, synthetic data, 39 alternatives/scenarios, existing chats and editable action plans are retained.

Every workspace is labeled **AI Agent Demo — Rules-Based**. These are simulated agent workflows implemented as deterministic, read-only DuckDB analysis and Python rules. They do not invoke a model, API key, paid endpoint, cloud service, or live operational integration.

## Demo flow

1. Open **AI Agents & Solutions** in the sidebar (`/agents`). Search by agent name, capability or original problem, or filter by department, original program context and solution complexity.
2. Select **Explore Agent**. The ID is the original opportunity ID.
3. Review the six sections: Original Movate Problem; AI Agent Objective; Relevant Synthetic Data; Agent Workflow; Generated Results and Recommendations; Solution Comparison and Action Plan.
4. Click **Run Agent**. Results contain calculated KPIs, findings, actual grouped records, calculation definitions, source IDs, limitations and recommended actions.
5. Export results, draft an editable action plan, or open the original scenario calculator. Observed results never include claimed scenario savings.

Changing the global scope or demo persona clears displayed run results. An in-flight result from the previous scope/persona cannot populate the new view. HR restrictions apply on the backend, before case queries.

## Agent mapping

| Original ID | Dedicated agent | Actual local workflow |
| --- | --- | --- |
| OPP-001 | Training Reporting Agent | Consolidates assigned/completed enrollments, course outcomes, trainer counts and separate QA context. |
| OPP-002 | Training Effectiveness Agent | Pairs employees with audits before and after their first completed enrollment, using clipped 30-day windows and disclosed sample sizes. |
| OPP-003 | Trainer Performance Agent | Joins trainer capability/certification/playbook fields to completed enrollment outcomes; reports enablement review candidates. |
| OPP-004 | Customer Support Agent | Joins Home Depot contacts/tickets, groups repeat issues/channels, reviews FCR, AHT, resolution hours, escalations and knowledge coverage. |
| OPP-005 | Sales Lead Optimization Agent | Uses SXM linked leads, declared source-score bands, observed conversions, consent flags and verification exceptions. |
| OPP-006 | Product Troubleshooting Agent | Groups Elvie contacts by category/complexity, unresolved volume and escalations; retrieves original program knowledge guidance. |
| OPP-007 | Self-Service & Demand Triage Agent | Recomputes Activision daily volume/peak flags, summarizes source self-service eligibility and linked knowledge, and reconciles supplied daily totals. |
| OPP-008 | QA Reporting Automation Agent | Consolidates audit scores/findings, critical-error flags, linked sample coverage and dated coaching statuses. |
| OPP-009 | Sales Quality Verification Agent | Reviews SXM completed-sale verification, consent and linked dated audit coverage using distinct existence checks. |
| OPP-010 | QA Workflow Integration Agent | Consolidates platform labels, audit acknowledgements and coaching links for the same audit cohort. |
| OPP-011 | HR Disciplinary Workflow Agent | HR Manager-only masked process queues for approval, hearing and acknowledgement flags; review-only draft checklist. |
| OPP-012 | HR Onboarding Agent | Detects missing documents and incomplete identity/policy/access steps; masked examples only for HR Manager. |
| OPP-013 | Employee Engagement Agent | Consolidates recognition events, participation, points, channels and source visibility without exposing individual participation lists. |

Names/objectives/capabilities describe the demo implementation. Original business problem text is read directly from `opportunity_catalog`; all source worksheet rows and proposed solutions remain accessible unchanged. The registry does not replace or rewrite any source record.

## Scope, assumptions and limits

- Program-specific customer-operations agents default to their original source program when the global filter says All programs. OPP-009 defaults to SXM because its original title/problem explicitly specifies SXM. An explicit global program overrides that context and is disclosed.
- Date filters apply to contact creation, audit dates, training assignment/completion, case opening or recognition events as defined by each result's method.
- Onboarding is a snapshot of all imported hire dates, filtered by program. It does not use the global date range to imply a new-hire cohort. No due/received/completed step timestamps exist, so delays or overdue cases cannot be measured; the agent says so explicitly.
- Training before/after differences are associations, not causal improvements. Trainer source indicators are not employment suitability ratings.
- Trainer playbook adoption below 80% is an explicit demo enablement-review rule. Sales score bands below 40 / 40–69 / 70+ are declared demo grouping rules, not validated predictions or original worksheet thresholds.
- Below-85 QA coaching checks use the original README's coaching-generation rule, not an invented compliance standard. Missing acknowledgements are process-review flags, not misconduct findings.
- Source knowledge IDs are joined through actual relationships. Article existence does not establish successful resolution or safe publication of product guidance.
- CRM/dialer writes, speech analysis, autonomous customer chats, real-time ingestion, document verification, e-signatures, HR form issuance, hearing scheduling, reward redemption and greeting delivery are not connected. Each relevant agent declares those limits. None is simulated with fabricated operational numbers.
- Source eligibility and campaign flags are synthetic inputs, not model predictions. Recognition points are not a monetary value or redeemable balance.
- Scenario costs/effects remain unvalidated USD assumptions in the existing calculator. No financial forecast or overlapping savings sum is generated by a run.
- A run appends an `agent_run` event to the existing local audit log. It changes no source/operational data. Saving/approving an action plan continues through the existing named-reviewer/department gates.

## Routes and compatibility

- `GET /api/agents`: original opportunity filters plus agent-name/objective/capability search, bounded `limit`/`offset`.
- `GET /api/agents/{opportunity_id}`: agent definition plus original problem, exact source records and existing alternatives.
- `POST /api/agents/{opportunity_id}/run`: body `{ "filters": { "program": "", "start": "2026-07-01", "end": "2026-10-15" } }`; existing `X-Demo-Role` enforcement.
- Canonical UI routes: `/agents`, `/agents/OPP-001` through `/agents/OPP-013`.
- `/opportunities` and `/opportunities/{id}` redirect while preserving search, comparison/source/plan query parameters and hashes. Previously saved chat citations remain functional.
- Existing `/api/opportunities`, scenario, chat, report, action-plan, department and data endpoints are preserved. No user-work migration or destructive database change is needed.

The existing AI Assistant remains available with its local rules-based fallback. Dedicated agent workflows do not call the assistant's optional provider adapter, even if provider environment variables happen to be configured. The delivered `.env` defaults keep external inference disabled.

## Implementation

`backend/agents.py` adds a source-linked registry and thirteen distinct workflow functions. `backend/main.py` adds three endpoints using existing readiness, role and schema validation. `frontend/src/App.tsx` extends the current cards, directory and detail routes and reuses the existing scenario calculator, data inspector and plan editor. `frontend/src/styles.css` extends the current liquid-glass theme and responsive rules. Existing data files and SQLite chats/plans are not replaced.

Tests are in `backend/tests/test_agents.py` and `frontend/tests/agents.spec.ts`. Existing browser assertions are updated only where navigation/title or original-requirement controls were intentionally renamed.
