---
name: test-flow
description: Build and verify the extension, then check for common issues.
disable-model-invocation: true
---

# Test Flow

Run the build and verification checks for the SAP Service Layer extension.

## Steps

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Check for build errors** — if the build fails, diagnose and fix

3. **Verify bundle output**
   - Confirm `dist/app.js` and `dist/api.js` exist
   - Check that all 6 operations are bundled

4. **Review common issues**
   - Missing imports in operation files
   - JSON parse errors in payload handling
   - Incorrect SAP entity paths (string keys need quotes)
   - Self-signed SSL not handled

5. **Report results** — summarize what passed and what needs fixing
