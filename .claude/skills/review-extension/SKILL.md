---
name: review-extension
description: Review the SAP extension code for quality, consistency, and SAP best practices.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

# Review SAP Extension

Review the codebase for quality and SAP integration correctness.

## Checklist

### Code Consistency
- [ ] All operations follow the same `api.js` / `app.js` pattern
- [ ] All operations use `createSapClient` from shared module
- [ ] All operations use `{ data, error }` return pattern
- [ ] JSON payloads handle both string and object inputs
- [ ] Error messages include operation name for debugging

### SAP Correctness
- [ ] PATCH used for updates (not PUT)
- [ ] String keys quoted: `BusinessPartners('C001')` not `BusinessPartners(C001)`
- [ ] Session ID passed via Cookie header
- [ ] Self-signed SSL handled (`rejectUnauthorized: false`)
- [ ] OData query params properly encoded

### Directus Integration
- [ ] Operation IDs match between `api.js` and `app.js`
- [ ] Operation IDs match `package.json` entries
- [ ] All options have proper `meta` config for Flow UI
- [ ] Required fields marked correctly

### Security
- [ ] No hardcoded credentials
- [ ] No secrets in committed files
- [ ] `.env` in `.gitignore`

Report findings with file paths and line numbers.
