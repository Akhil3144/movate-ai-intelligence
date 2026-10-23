# GitHub → Vercel deployment

Preparation only: this workspace has not been published. Keep the repository private. The existing React UI and deterministic Python workflows run unchanged; the hosting adaptations concern routing, read-only data, authentication and persistence.

## Prepare the repository

Use Python 3.12 and Node 22.12+ (select Node 24 in Vercel). Local setup uses `requirements-dev.txt`; hosted installation uses only `requirements.txt`.

```bash
npm run prepare:vercel
MOVATE_SERVERLESS=1 npm run build:vercel
.venv/bin/python -m pytest backend/tests -q
npm test
```

`prepare:vercel` uses the already validated local import. If sources changed, run `.venv/bin/python -m backend.data` first. Commit the source/configuration and all three files in `deployment/data`: `movate.duckdb`, `status.json`, `manifest.json`. The DuckDB file is intentionally allowed by `.gitignore`. Do not commit `.env`, virtual environments, local SQLite, source archives or unrelated files. Review the staged files before pushing to your private GitHub repository. This delivered directory has no Git repository initialized; create/connect your own private repository as a separate step.

The bundle has all 21 synthetic tables, 13 canonical problems, 19 original source rows, 39 alternatives and original worksheet-cell mapping. Only sanitized workbook names are retained. Full source XLSX/ZIP files are not served. Bundle integrity and table counts are checked once per warm function process; the data is never rebuilt on requests.

## Import on Vercel

1. In Vercel, Add New → Project → import the private GitHub repository.
2. Set **Root Directory to the repository root (`.`)**, not `frontend`. Framework preset: **Vite**. Select Node 24. `.python-version` pins Python 3.12.
3. Retain settings supplied by `vercel.json`: install `npm --prefix frontend ci`, build `npm run build:vercel`, output `frontend/dist`.
4. Before deploying, add the following **server-only** environment variables to both Preview and Production:

| Variable | Value |
| --- | --- |
| `MOVATE_DEMO_USERNAME` | A private demo username |
| `MOVATE_DEMO_PASSWORD` | A unique random secret, at least 24 characters; generate with `openssl rand -hex 32` |

Do not prefix these with `VITE_`, commit them, or share them in URLs. No AI key, database URL, data path or LLM provider is required. Vercel supplies `VERCEL=1`; it enables the read-only/stateless runtime and browser-local frontend build. Do not set `MOVATE_BUNDLE_DIR` or development file paths on Vercel. Environment changes require a redeploy.

5. Enable Vercel Deployment Protection for **all deployments**, including the production URL, and configure permitted client access using the options available in your account. Verify access from a signed-out browser. This protects the static application shell as well as the API. Independently, every API request requires the server-side demo credentials above; missing configuration fails closed with 503. A frontend password prompt is not used.
6. Once preparation is reviewed, deploy from Vercel. This step publishes the application; it has not been executed here.
7. Visit `/api/auth/login` on the HTTPS deployment URL and enter the demo credentials in the browser's native authentication dialog. The server sets an eight-hour signed Secure/HttpOnly session cookie. Open `/` and run the acceptance checks below. Rotate the password and redeploy to invalidate sessions. Demo personas remain illustrative roles, not individual user accounts.

Routing uses the single ASGI `app` in `api/index.py`. `/api/*` forwards to that Python function with an explicit original-path parameter. Non-API application routes fall back to `index.html`; missing API routes return JSON 404. Frontend requests are same-origin `/api`, with no localhost backend URL in production. The API uses private/no-store responses.

These settings follow the current [Vite integration](https://vercel.com/docs/frameworks/frontend/vite), [Python runtime](https://vercel.com/docs/functions/runtimes/python), [project configuration](https://vercel.com/docs/project-configuration/vercel-json), and [Deployment Protection](https://vercel.com/docs/deployment-protection) documentation.

## Hosted persistence and limitations

Chats, action-plan drafts and review artifacts are saved in this browser's localStorage, separated by deployment origin and demo persona. They survive reloads but are not shared across devices, browsers or preview URLs. Clearing site data removes them. Export answers/plans for backup. Blocked/full/damaged browser storage produces an explicit error; a generated answer remains available for export if saving fails.

Every answer, agent workflow and plan validation still executes the real backend against DuckDB. The browser forwards bounded prior conversation context for stateless follow-ups; numerical results are recalculated. Backend chat/plan lists are intentionally empty in hosted mode. SQLite remains available only in local development. No hosted filesystem or `/tmp` write is treated as persistent. Function events go to platform logs; browser activity and saved approvals are not a durable audit/compliance record.

Hosted source re-import is disabled (405). Refresh the validated bundle locally and redeploy. External inference is disabled server-side even if provider environment variables are present. No live integrations are introduced; existing agent limitations remain explicit.

The function limit is configured to 60 seconds; browser requests time out after 65 seconds with a clear retry message. Database integrity/startup failures return `DATA_INIT_FAILED` (503); connectivity and unexpected HTML routing errors have explicit UI messages. Cold-start and actual platform limits still need validation on your first protected deployment.

## Verify the first protected deployment

- Signed-out `/api/overview` must return 401; `/api/auth/login` must authenticate, and missing/short configured credentials must fail closed.
- Overview shows 12,000 interactions; QA 2,200 audits; Training 1,000 enrollments. Check program/date filters.
- Open and run all 13 agent workspaces (HR Manager for restricted HR workflows); inspect original problems, source citations and limitations.
- Ask a grounded question, follow up, reload/resume the conversation. Compare all three alternatives and change adoption to 0% then 100%.
- Create/edit/save a draft, reload Reports, export a report and draft. A different browser should have no saved work.
- Refresh `/agents/OPP-008`, `/assistant`, `/quality`, `/training`, `/hr`, `/reports`, `/settings`. `/api/not-a-route` must return JSON 404, not HTML.
- Review Vercel function logs for initialization failures/timeouts. Never put credentials into test logs.

## Reproduce local production checks

```bash
MOVATE_SERVERLESS=1 npm run build:vercel
.venv/bin/python scripts/serve_vercel_preview.py --port 5174
# another terminal; Playwright Chromium must already be installed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 \
MOVATE_PREVIEW_CREDENTIALS=/private/tmp/movate-vercel-preview.json \
npm --prefix frontend run test:e2e
```

The harness creates random temporary test credentials with mode 0600, serves the real production assets, and emulates explicit API forwarding. It does not deploy. Stop it with Ctrl+C. `scripts/verify_serverless.py` can additionally run with a clean Python 3.12 environment containing only `requirements.txt`. `npm run dev` continues to use the original Vite/FastAPI/SQLite workflow; normal `npm run build` does not enable browser-local hosting mode outside Vercel.
