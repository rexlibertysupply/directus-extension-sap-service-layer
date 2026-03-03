# CLAUDE.md — SAP Service Layer Extension

## Project Type
Directus bundle extension containing SAP Service Layer operations for use in Directus Flows.

## Operations (3 total)
1. `sap-login` — Authenticate with SAP Service Layer (POST /Login)
2. `sap-logout` — End SAP session (POST /Logout)
3. `sap-request` — Generic CRUD for any SAP entity (GET/POST/PATCH/DELETE)

## Commands
- `npm run build` — Build the extension
- `npm run dev` — Watch mode (rebuilds on change)

## Rules
See `.claude/RULES.md` for the full rules list — always follow these.
- JavaScript only (no TypeScript), ES modules
- Each operation has `api.js` (server handler) and `app.js` (Vue options UI)
- Shared logic lives in `src/shared/` — SAP HTTP client, constants, error helpers
- All SAP connection details must come from operation options or env vars — never hardcoded
- Handle self-signed SSL certs (SAP on-prem standard)
- Normalize SAP error responses into `{ code, message }` format
- Every operation must return a clear success/failure shape for downstream flow steps
- Use tryCatch-style `{ data, error }` pattern for SAP HTTP calls
- Log SAP request/response details at debug level for troubleshooting

## SAP Service Layer
- Base URL pattern: `https://<host>:50000/b1s/v1/`
- Session auth: POST /Login → B1SESSION cookie
- OData query params: $filter, $select, $top, $skip, $orderby
- PATCH for updates (not PUT)
- String-based keys for many entities (CardCode, ItemCode)
