# Bug Hunt

Perform a full audit of the codebase. Identify and report all potential issues across three categories: fail traps, security vulnerabilities, and incorrect returns. Do NOT fix anything — report findings only unless explicitly asked to fix.

## Scope

Audit all source files under `src/`:
- `src/shared/` — sap-client.js, session-pool.js, crypto.js, constants.js
- `src/hooks/` — sap-auto-login.js
- `src/login/` — api.js, app.js
- `src/logout/` — api.js, app.js
- `src/request/` — api.js, app.js

---

## 1. Fail Traps

Look for code paths that can silently fail, cause unhandled exceptions, or produce unexpected behavior at runtime:

- Unhandled promise rejections or missing try/catch
- Assumptions about data shape (e.g. accessing `.property` on a potentially null/undefined value)
- Missing null/undefined checks before use
- Operations that could throw but are not wrapped (JSON.parse, crypto operations, service calls)
- Race conditions or shared mutable state that could corrupt across concurrent flow executions
- Missing `await` on async calls
- Infinite loops or unguarded recursion
- Silent swallowing of errors (catch blocks that do nothing or only log)
- Expired or missing session not handled before use

---

## 2. Security Vulnerabilities

Look for security issues that could expose credentials, enable injection, or leak sensitive data:

- Plaintext credentials in logs, return values, or error messages
- SAP passwords or session IDs appearing in stack traces or thrown errors
- Missing input sanitisation before use in SAP OData queries (injection risk)
- Sensitive values stored in places that could be serialised or returned to the client
- Encryption key misuse — weak derivation, IV reuse, missing auth tag validation
- Session pool entries retaining plaintext passwords longer than necessary
- Token or session ID exposure in error messages
- Missing `rejectUnauthorized` enforcement (SSL bypass left open)

---

## 3. Incorrect Returns

Look for operations that return the wrong shape, wrong value, or nothing when something is expected:

- Handler returning `undefined` instead of a value on a valid code path
- Resolve/reject path shape mismatches — downstream flow steps expecting `{ sessionId }` but receiving something else
- SAP client methods returning `{ data: null, error: null }` on edge cases
- Status 204 responses handled correctly vs other no-body responses
- `ensureSession` returning a session object inconsistently (sometimes with `sessionId`, sometimes without)
- `getSapCredentials` returning partial objects
- Error objects missing required fields (`code`, `message`, `statusCode`)
- App.js overview functions returning undefined fields

---

## Output Format

Report findings grouped by category. For each issue include:

```
File: src/path/to/file.js
Line: <line number or range>
Issue: <concise description>
Risk: Low | Medium | High | Critical
Detail: <explanation of what can go wrong>
```

End with a summary count per category and an overall risk rating.
