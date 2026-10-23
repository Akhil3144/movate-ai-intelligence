# Deployment preparation verification

Prepared 2026-10-23. No application was published and no project was linked.

- Existing plus serverless backend tests: **75 passed**.
- Frontend unit tests, including browser persistence and error cases: **8 passed**.
- Normal production build and hosted-mode production build: passed.
- Clean Python **3.12.13** runtime with only `requirements.txt`: actual `api.index:app` loaded; all 13 workflows ran; dashboards, scenario comparisons, CSV/JSON report exports, original source mapping, stateless conversational context, plan validation, authentication and cross-origin rejection passed (`scripts/verify_serverless.py`). No pandas/openpyxl or SQLite was required.
- All 17 dependency wheels were downloaded successfully for Linux CPython 3.12 x86_64. Combined uncompressed wheel contents: **71.74 MB**; curated data bundle **6.65 MB**. This is a dependency/data estimate, not a measured Vercel function artifact. Vercel documents a 500 MB Python function limit.
- Current Vercel routing-utils accepted and compiled the configured headers and rewrites without errors. API forwarding preserves the original path and query and excludes API paths from the SPA fallback.
- Vercel CLI **65.2.0** `vercel build --yes` could not proceed: the existing account token was invalid. An actual Vercel function build and protected preview URL remain to be checked after account login and project import. No credentials were printed and no login or deployment was performed.

The production-bundle browser harness tests actual generated assets and the real stateless ASGI application; it is not the Vercel edge/runtime. Production-bundle Chromium results: **20 passed**, including all 18 existing browser tests plus hosted persistence/access tests. All 13 agents, scenario adoption changes, report downloads, source mapping and deep-route refreshes passed. Platform cold starts, production authentication configuration and deployed routing must still be smoke-tested using the checklist in [VERCEL.md](VERCEL.md).

## Changed code and configuration

- `api/index.py`, `vercel.json`, `.python-version`: Python ASGI entry point, same-origin API forwarding, SPA refresh fallback, Vite build/output, function duration and curated bundle inclusion.
- `requirements.txt`, `requirements-dev.txt`, `scripts/setup.sh`: separate lean pinned hosted dependencies from local import/test/server tooling.
- `backend/runtime.py`, `backend/data.py`: hosted runtime detection, read-only DuckDB, lazy local-only importer dependencies, integrity/count validation and clear initialization errors.
- `backend/access.py`, `backend/main.py`: fail-closed server-side authentication, signed session cookie, write-origin checking, explicit original API path restoration, hosted stateless endpoints, read-only import limitation.
- `backend/storage.py`, `backend/ai.py`: preserve local SQLite while disabling hosted writes; bounded client conversation context; external inference forced off in hosted mode.
- `frontend/src/browserStorage.ts`, `lib.ts`, `env.d.ts`, `vite.config.ts`: browser-only saved chats/plans, real backend validation and calculations, same-origin transport and explicit timeout/connectivity/storage errors.
- `frontend/src/App.tsx`: hosted persistence/auth/error labels and disabled hosted import; route-transition location binding prevents transient destination remounts. Styles, assets and animation definitions are unchanged.
- `deployment/data/*`, bundle preparation/verification scripts: sanitized three-file synthetic snapshot, hashes and 21-table counts. `.gitignore`/`.vercelignore` restrict uploaded files.
- Backend serverless tests, frontend persistence tests, hosted Playwright tests/config, `scripts/verify_serverless.py`, `scripts/serve_vercel_preview.py`: real runtime and browser verification without publishing.
- `README.md`, `.env.example`, deployment documentation: local setup preserved, exact private GitHub/Vercel steps and explicit hosting limitations.

Original local Vite/FastAPI/SQLite browser regression: **18 passed**. Normal frontend production build and final eight frontend unit tests passed after the route binding fix. Additional authentication regression (six tests) passed after tightening redirect-path validation. The temporary production harness was stopped; the original local development servers were left running.
