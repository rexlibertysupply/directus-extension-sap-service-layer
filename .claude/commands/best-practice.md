# `/best-practice` — Codebase Audit Command

> A custom Claude Code command that audits your JavaScript/TypeScript codebase against gold-standard software engineering practices. It produces a severity-ranked report with concrete fix suggestions.

---

## How the Audit Works

1. **Discover the codebase** — scan the project structure, identify frameworks and entry points.
2. **Sample strategically** — read key files (entry points, core modules, utilities, configs, tests).
3. **Evaluate against the checklist** — apply every category from the audit checklist.
4. **Produce the report** — write a structured report with findings, severity, and fix suggestions.

---

## Step 1: Discovery

Run these commands to understand the project shape:

```bash
# Project structure (2 levels deep)
find . -maxdepth 2 -type f | head -80

# JS/TS file breakdown
find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.vue' \) \
  | grep -v node_modules | head -60

# Config files
ls -la package.json tsconfig.json nuxt.config.* vite.config.* next.config.* \
  .eslintrc* .prettierrc* tailwind.config.* Dockerfile 2>/dev/null
```

---

## Step 2: Strategic Sampling

Don't try to read every file. Prioritize:

1. **Entry points** — `index.*`, `app.*`, `server.*`, `main.*`, `nuxt.config.*`
2. **Core business logic** — the thickest modules in `src/`, `lib/`, `composables/`, `services/`
3. **Utility / helper files** — `utils.*`, `helpers.*`, `common.*`
4. **Data layer** — models, schemas, API clients, database access
5. **Configuration** — env handling, config loaders, constants
6. **Tests** — sample a few test files to assess test quality
7. **Recently changed files** — `git log --oneline -20 --name-only` (if git is available)

Read at least 8–12 files across these categories for a meaningful audit.

---

## Step 3: The Audit Checklist

For each finding, note:

- **What** — the specific issue
- **Where** — file and approximate location
- **Why it matters** — the real-world consequence
- **Fix** — a concrete suggestion

---

### Category 1: Abstraction Level Mixing

Functions should operate at a single level of abstraction. This is one of the most common sources of cognitive overload.

**Red flags:**

- A function that mixes raw HTTP parsing with business logic decisions
- A handler that validates data, queries the DB, formats the response, and sends emails — all inline
- Low-level string/buffer manipulation interleaved with high-level orchestration
- Direct database queries or file system calls inside business rule functions
- A composable or hook that handles API calls, state management, and UI logic in one blob

**Gold standard:**

- Each function reads like a paragraph at one level of abstraction
- High-level orchestrators (prefixed `handle*`) call well-named mid-level functions
- Low-level operations are wrapped in descriptive utility functions
- You can understand what a function does without reading its callees

---

### Category 2: Naming Conventions

#### Function Prefixes — Exported Functions

Every exported function must use a standardized prefix that signals its intent at a glance.

**Common prefixes:**

| Prefix | Purpose |
|---|---|
| `build*` | Constructs configuration objects (pure functions) |
| `create*` | Constructs new objects, streams |
| `fetch*` | Retrieves data via network requests (HTTP/I/O) |
| `get*` | Retrieves local, cached, or computed data (no network I/O) |
| `handle*` | Orchestrates workflows, events, flows |
| `validate*` | Performs validation with error throwing |

**Available when needed:**

| Prefix | Purpose |
|---|---|
| `apply*` | Mutates config/pipeline with overrides |
| `generate*` | Creates filenames, handles, derived values |
| `init*` | Creates instances with internal state |
| `map*` | Reshapes one structure into another |

Vue/Nuxt framework callbacks and lifecycle names are exempt from prefix rules.

**Red flag:** A function named `fetch*` that reads from a local cache (should be `get*`), or a `get*` that makes a network call (should be `fetch*`). The prefix must accurately describe the operation's nature.

#### Variable Naming

- Descriptive, unabbreviated names — always
- Booleans use the `isVerb` pattern: `isLoading`, `isVisible`, `hasPermission`
- Use `const` for config objects, `let` only for reassigned variables
- Constants are `UPPER_SNAKE_CASE` and self-documenting

#### Prohibited Names

| Banned | Use Instead |
|---|---|
| `data` | Descriptive name: `userData`, `invoiceList`, `responsePayload` |
| `result` | Descriptive name: `validationOutcome`, `searchMatches` |
| `item` | Domain name: `product`, `contact`, `invoice` |
| `val`, `tmp` | Full descriptive name |
| `opts`, `cfg` | `options`, `config` |
| Single-letter vars | Full name (loop counters `i`/`j` in simple loops are acceptable) |

**Exception:** `tryCatch` returns `{ data, error }` — this is an allowed pattern for the utility's destructured return value.

#### Unused Parameters

Remove unused parameters entirely — never use `_` prefix to silence linting warnings.

#### Additional Naming Red Flags

- Inconsistent casing within the same codebase (mixing camelCase and snake_case)
- Function names that don't describe what they do (`process()`, `doStuff()`, `run()`)
- Misleading names (a function called `validate` that also mutates data)

---

### Category 3: Function Design

**Red flags:**

- Functions longer than ~40 lines (a sign they're doing too much)
- Functions with more than 3–4 parameters (consider an options object)
- Functions with boolean "flag" parameters that branch into two different behaviors
- Functions that both compute a value AND cause a side effect (query + command)
- Deeply nested conditionals (> 3 levels of indentation)
- Functions that silently return different types or shapes

**Gold standard:**

- Functions do one thing and do it well
- Pure functions where possible (same input → same output, no side effects)
- Side effects are explicit, isolated, and pushed to the edges
- Early returns to flatten control flow
- Complex conditionals extracted into well-named predicate functions (e.g., `isEligibleForDiscount()`)

---

### Category 4: Error Handling

**Red flags:**

- Empty `catch(e) {}` — swallowing all errors silently
- Returning `null` / `undefined` to signal errors instead of throwing or using a Result pattern
- Inconsistent error strategy (some functions throw, some return error codes, some return null)
- Missing error handling on I/O, network, and JSON parsing operations
- Error messages that provide no context: `"Something went wrong"`
- Catching errors only to re-throw them with less information
- `.catch()` on a promise that just logs and continues as if nothing happened

**Gold standard:**

- Consistent error handling strategy across the codebase (e.g., always use `tryCatch` utility pattern returning `{ data, error }`)
- Errors carry context: what failed, with what inputs, and why
- Expected failures (user input, network) handled differently from bugs
- Resource cleanup in `finally` blocks
- Custom error classes for domain-specific failures (e.g., `ValidationError`, `NotFoundError`)

---

### Category 5: Concurrency & Race Conditions

**Red flags:**

- Shared mutable state accessed from concurrent async operations without guards
- Check-then-act patterns without atomicity (TOCTOU): `if not exists → create`
- Fire-and-forget async operations with no error handling (floating promises)
- Database operations that assume single-writer without transactions
- Unbounded concurrency (spawning unlimited `Promise.all` with no limit)
- Event handlers that assume sequential execution
- Stale closure reads in `setTimeout`, `setInterval`, or event listeners capturing old state
- Race conditions in Vue/React reactivity: watchers triggering async work that resolves out of order

**Gold standard:**

- Shared state is minimized; prefer immutable data and reactive state management
- Async operations have proper error handling and cancellation (`AbortController`)
- Database transactions used for multi-step operations
- Concurrency bounded with batching or `p-limit` / semaphore patterns
- Watchers that trigger async work use cancellation tokens or sequence guards to ignore stale results

---

### Category 6: Dependency & Coupling

**Red flags:**

- God objects/modules that everything depends on
- Circular imports / circular dependencies (especially common in Node.js — causes subtle bugs)
- Business logic that directly calls framework internals
- Tight coupling to specific external services without abstraction
- Importing deep internal paths from libraries (`import lib/internal/secret/thing`)
- Modules with dozens of imports from unrelated areas
- Barrel files (`index.ts`) re-exporting everything — bloats bundles, hides dependency graphs

**Gold standard:**

- Dependency flow is unidirectional (layered architecture)
- External services accessed through abstractions (API client wrappers, repository pattern)
- Modules have a clear, narrow public API
- Changes to one module don't cascade across the codebase
- Named exports preferred over default exports (better refactoring and find-all-references)

---

### Category 7: Code Duplication & DRY

**Red flags:**

- Copy-pasted blocks with minor variations
- Multiple implementations of the same algorithm or business rule
- Nearly identical functions that differ by one parameter
- Repeated patterns that should be a composable, utility function, or middleware

**Gold standard:**

- Common patterns extracted into reusable composables or utility functions
- Shared behavior captured in higher-order functions or mixins
- Configuration differences driven by data, not code duplication
- BUT: avoid premature abstraction — two similar things aren't always the same thing

---

### Category 8: Security Basics

**Red flags:**

- Hardcoded secrets, API keys, or passwords in source code
- SQL or query strings built by string concatenation
- User input used without sanitization in commands, queries, or templates
- Overly permissive CORS configuration
- Logging sensitive data (tokens, passwords, PII)
- Disabled security features in non-dev configs
- Using `eval()` or `new Function()` with user-influenced input
- Missing CSP headers, CSRF protection, or rate limiting on public endpoints
- Storing secrets in `.env` files committed to git

**Gold standard:**

- Secrets managed through environment variables or vaults, never in code
- Parameterized queries / prepared statements everywhere
- Input validation at system boundaries (Zod, Joi, or equivalent)
- Principle of least privilege applied to permissions
- Security-sensitive code has clear comments about why
- `.env` in `.gitignore`, `.env.example` committed with placeholder values

---

### Category 9: Testing Quality

**Red flags:**

- No tests at all
- Tests that test implementation details rather than behavior
- Tests with no assertions (they pass but prove nothing)
- Test names that don't describe the scenario: `test1`, `testHelper`
- Tests that depend on execution order or shared mutable state
- Mocking so much that the test doesn't test anything real
- No edge case coverage (empty inputs, nulls, boundaries, errors)

**Gold standard:**

- Tests describe *what* should happen, not *how* it's implemented
- Test names read like specifications: `should reject expired tokens`
- Each test is independent and can run in isolation
- Mix of unit (fast, focused), integration (boundaries), and a few end-to-end
- Edge cases and error paths are tested, not just the happy path
- Vitest or Jest configured with coverage thresholds

---

### Category 10: Project Structure & Configuration

**Red flags:**

- Flat file structure with everything in one directory
- No clear separation between app code, tests, and config
- Mixed concerns in single directories (API handlers next to DB migrations)
- Missing or misleading README
- No `.gitignore`, committing `node_modules` or generated files
- Inconsistent or missing linting/formatting config
- Side effects in module scope that run on import

**Gold standard:**

- Directory structure reflects architectural layers or feature domains
- Config separated from code, with environment-specific overrides
- Clear README with setup instructions, architecture overview, and conventions
- Consistent formatting enforced by tooling (Prettier + ESLint)
- CI config present and meaningful
- Path aliases configured if deep relative imports (`../../../../`) are common

---

## Step 4: The Report

Produce a report with this structure:

```
# Best Practice Audit Report

**Project:** [name]
**Date:** [today]
**Languages:** [detected]
**Framework:** [Vue/Nuxt/React/Next/Express/etc.]
**Files sampled:** [count]

## Executive Summary

[2-3 sentence overview: overall health + single biggest improvement opportunity]

## Findings by Severity

### 🔴 Critical (fix now — active risk to correctness or security)

#### [Finding title]
- **Category:** [from the checklist]
- **Where:** `path/to/file.ext` (lines ~N-M)
- **Issue:** [what's wrong]
- **Impact:** [real-world consequence]
- **Fix:** [specific suggestion, with a code sketch if helpful]

### 🟡 Warning (fix soon — harms maintainability or reliability)
[same structure]

### 🔵 Suggestion (improve when convenient — raises code quality)
[same structure]

## Scorecard

| Category                          | Rating     | Notes                    |
|-----------------------------------|------------|--------------------------|
| Abstraction Level Consistency     | 🟢/🟡/🔴  | ...                      |
| Naming Conventions                | 🟢/🟡/🔴  | ...                      |
| Function Design                   | 🟢/🟡/🔴  | ...                      |
| Error Handling                    | 🟢/🟡/🔴  | ...                      |
| Concurrency Safety                | 🟢/🟡/🔴  | ...                      |
| Dependency & Coupling             | 🟢/🟡/🔴  | ...                      |
| Code Duplication                  | 🟢/🟡/🔴  | ...                      |
| Security Basics                   | 🟢/🟡/🔴  | ...                      |
| Testing Quality                   | 🟢/🟡/🔴  | ...                      |
| Project Structure                 | 🟢/🟡/🔴  | ...                      |

## Top 3 Recommended Actions

1. [Most impactful improvement]
2. [Second most impactful]
3. [Third most impactful]
```

### Severity Guidelines

- **🔴 Critical:** Race conditions, security vulnerabilities, silent data loss, unhandled errors in critical paths
- **🟡 Warning:** Abstraction mixing, poor naming, missing tests, high coupling, code duplication
- **🔵 Suggestion:** Minor naming tweaks, structural improvements, documentation gaps, style inconsistencies

---

## TypeScript-Specific Checks

Apply these **on top of** the general checklist when TypeScript is detected.

### Type Safety

- `any` usage — every `any` is a hole in type safety. Flag all instances.
- Type assertions (`as SomeType`) used to silence the compiler instead of fixing the type
- Missing return types on exported/public functions
- `!` (non-null assertion) used to suppress strictNullChecks instead of proper narrowing
- Loose types where precise ones exist: `object` instead of a defined interface
- `@ts-ignore` / `@ts-expect-error` without justification comments
- Implicit `any` from untyped library imports (missing `@types/*`)

Gold standard: `strict: true` in tsconfig with no opt-outs, discriminated unions for variant types, Zod or similar for runtime validation at boundaries, utility types (`Pick`, `Omit`, `Partial`, `Record`) to reduce duplication.

### TS Configuration

- `tsconfig.json` should have `strict: true`
- ESLint configured with `@typescript-eslint` rules
- Path aliases configured for clean imports

---

## Vue / Nuxt-Specific Checks

Apply these when Vue or Nuxt is detected.

### Composition API & Composables

- Using Options API in new code (prefer Composition API with `<script setup>`)
- Composables that do too much — a composable should encapsulate one concern
- Reactive state leaked outside composables without proper cleanup
- Missing `onUnmounted` / `onBeforeUnmount` cleanup for event listeners, intervals, subscriptions
- `ref` vs `reactive` used inconsistently — prefer `ref` for primitives, `reactive` for objects, and be consistent

### Template & Reactivity

- `v-for` without `:key` or using index as key on dynamic lists
- Mutating props directly instead of emitting events
- Deeply nested `v-if` / `v-else` chains in templates (extract into computed properties)
- Computed properties with side effects (should be pure)
- Watchers that could be computed properties instead

---

## React-Specific Checks

Apply these when React is detected.

- Prop drilling through 4+ levels (use context or state management)
- Components over 200 lines (split into sub-components)
- Business logic inside components (extract to hooks or pure functions)
- Missing `key` prop on list items, or using array index as key on dynamic lists
- `useEffect` with missing or incorrect dependency arrays
- `useEffect` used for derived state (should be `useMemo` or computed inline)
- State that could be derived from other state (redundant state)
- Direct DOM manipulation (`document.querySelector`) instead of refs

---

## Node.js Server-Side Checks

Apply these when a server-side Node.js application is detected.

- Unvalidated `req.body` / `req.params` used directly in queries or logic
- Synchronous file I/O (`readFileSync`) in request handlers
- Missing graceful shutdown handling for the process
- Environment variables accessed without defaults or validation
- Memory leaks: event listeners not cleaned up, growing caches without eviction
- Missing rate limiting on public-facing endpoints
- No request ID / correlation ID for tracing across services

---

## Tone Guidance

Be direct and specific. Don't say "consider improving naming" — say `remainingAttempts` is clearer than `n` in `retryLoop()` at line 42 of `worker.ts`. Every finding must include a concrete fix suggestion.

Also acknowledge what the codebase does well. If error handling is solid, say so. Good engineering should be recognized, not just deficiencies.
