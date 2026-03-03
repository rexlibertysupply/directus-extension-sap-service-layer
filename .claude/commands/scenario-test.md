# Scenario Test

Perform a scenario-based walkthrough of the codebase. Do NOT test against real values or make live calls. Trace each scenario through the code — identify which branches execute, what the expected outcome is, and flag any scenario that cannot be handled correctly.

## Scope

Trace all source files under `src/`:
- `src/shared/` — sap-client.js, session-pool.js, crypto.js, constants.js
- `src/hooks/` — sap-auto-login.js
- `src/login/` — api.js
- `src/logout/` — api.js
- `src/request/` — api.js

---

## Scenarios to Trace

### Session Pool

| # | Scenario |
|---|----------|
| SP-1 | User logs into Directus — SAP credentials exist on their profile → auto-login fires, session stored in pool |
| SP-2 | User logs into Directus — SAP credentials are missing or blank → auto-login skipped silently |
| SP-3 | Two concurrent requests arrive for the same user with no cached session → only one SAP login is made (in-flight deduplication) |
| SP-4 | Session exists in pool but has expired (past expiresAt) → session is treated as missing, re-auth triggered |
| SP-5 | Session exists and is still valid → cached session returned, no SAP login made |
| SP-6 | ensureSession fails (SAP unreachable or bad credentials) → error propagates cleanly to caller |

### SAP Login Operation

| # | Scenario |
|---|----------|
| LG-1 | serviceLayerUrl and companyDB provided in options → used directly |
| LG-2 | serviceLayerUrl not provided, env var SAP_SERVICE_LAYER_URL is set → env var used |
| LG-3 | Neither serviceLayerUrl option nor env var set → error thrown with clear message |
| LG-4 | companyDB not provided, env var SAP_COMPANY_DB is set → env var used |
| LG-5 | userName or password is blank → error thrown before any SAP call |
| LG-6 | SAP returns a login error (wrong credentials, DB offline) → error caught, descriptive error thrown |
| LG-7 | Login succeeds, user context exists → session stored in pool |
| LG-8 | Login succeeds, no user context (anonymous flow) → session NOT stored, only returned |

### SAP Logout Operation

| # | Scenario |
|---|----------|
| LO-1 | Valid sessionId provided → SAP logout called, session removed from pool |
| LO-2 | sessionId missing → error thrown before SAP call |
| LO-3 | SAP logout returns error (session already expired) → error caught, thrown to flow |
| LO-4 | Logout succeeds with no matching pool entry → removeSession is a no-op, no crash |

### SAP Request Operation — Session Pool Mode (useSessionPool: true)

| # | Scenario |
|---|----------|
| RQ-1 | Valid cached session → request proceeds using pooled sessionId |
| RQ-2 | No cached session → ensureSession triggers auto-login, request proceeds |
| RQ-3 | SAP returns 401 (session expired mid-flow) → session removed, re-auth once, request retried |
| RQ-4 | SAP returns 401 and re-auth also fails → error thrown, no infinite retry |
| RQ-5 | No user context (accountability.user is null) → falls back to explicit sessionId mode |
| RQ-6 | useSessionPool is true but no Directus user (e.g. API key context) → falls back to explicit sessionId |

### SAP Request Operation — Explicit Session Mode (useSessionPool: false)

| # | Scenario |
|---|----------|
| RQ-7 | sessionId provided explicitly → used directly, pool not touched |
| RQ-8 | sessionId not provided and pool is disabled → error thrown with clear message |
| RQ-9 | serviceLayerUrl not provided and env var not set → error thrown with clear message |

### SAP Request — Input Handling

| # | Scenario |
|---|----------|
| RQ-10 | queryParams is a valid JSON string → parsed correctly |
| RQ-11 | queryParams is already an object → used as-is |
| RQ-12 | queryParams is a malformed JSON string → error thrown with descriptive message |
| RQ-13 | body is a valid JSON string → parsed correctly |
| RQ-14 | body is a malformed JSON string → error thrown with descriptive message |
| RQ-15 | entityKey contains a single quote (e.g. "O'Brien") → escaped to `''` before OData path |
| RQ-16 | entityKey is null or undefined → path uses bare entity name (collection only) |
| RQ-17 | method is unsupported (e.g. PUT) → error thrown with clear message |

### Password Encryption Hook

| # | Scenario |
|---|----------|
| EN-1 | User updated with a new plaintext sap_password → encrypted before DB write |
| EN-2 | User updated with an already-encrypted sap_password (enc: prefix) → not re-encrypted |
| EN-3 | User updated with no sap_password field → hook passes through unchanged |
| EN-4 | Directus SECRET env var not set when encryption attempted → error thrown, save blocked |
| EN-5 | encrypt() throws an unexpected error → caught, descriptive error thrown, save blocked |
| EN-6 | Same logic applies to users.create as to users.update |

### Credential Retrieval

| # | Scenario |
|---|----------|
| CR-1 | User has all SAP fields set → credentials returned with password decrypted |
| CR-2 | User has no SAP fields set (all null) → null returned, caller skips login |
| CR-3 | sap_password is stored encrypted → decrypted correctly before use |
| CR-4 | sap_password is stored plaintext (legacy, no enc: prefix) → decrypt() passes through, used as-is |
| CR-5 | Directus SECRET not set when decryption attempted → error thrown |
| CR-6 | UsersService throws (DB error, user not found) → error propagates to ensureSession, which throws |

---

## Output Format

For each scenario, report the trace result:

```
ID: <scenario ID>
Scenario: <scenario description>
Result: PASS | FAIL | GAP
Trace: <code path summary — which branches/functions execute and in what order>
Detail: (only for FAIL or GAP) <what goes wrong or what is missing>
```

**PASS** — The code handles this scenario correctly end-to-end.
**FAIL** — The code fails, panics, or produces a wrong result for this scenario.
**GAP** — The scenario is not handled (missing branch, no guard, silent skip).

End with a summary table of all scenario results and a count of PASS / FAIL / GAP.
