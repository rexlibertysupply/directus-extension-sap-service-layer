---
name: sap-operation
description: Scaffold or implement a new SAP Service Layer operation for the Directus bundle extension.
disable-model-invocation: true
argument-hint: [operation-name]
---

# SAP Operation: $ARGUMENTS

Implement or update the SAP operation `$ARGUMENTS` following these rules:

## Structure

Each operation needs two files:
- `src/$ARGUMENTS/api.js` — Server-side handler
- `src/$ARGUMENTS/app.js` — Vue options UI for Directus Flow builder

## api.js Pattern

```js
import { createSapClient } from '../shared/sap-client.js';

export default {
  id: 'sap-$ARGUMENTS',
  handler: async (options) => {
    const { serviceLayerUrl, sessionId, ...rest } = options;
    const client = createSapClient({ serviceLayerUrl, sessionId });

    const { data, error } = await client.get(/* or post/patch */);

    if (error) {
      throw new Error(`SAP ... failed: ${error.message}`);
    }

    return data;
  },
};
```

## app.js Pattern

```js
export default {
  id: 'sap-$ARGUMENTS',
  name: 'SAP ...',
  icon: 'icon_name',
  description: '...',
  overview: ({ field }) => [{ label: 'Label', text: field }],
  options: [
    // serviceLayerUrl and sessionId are always required
    // add operation-specific fields
  ],
};
```

## Rules
- Always include `serviceLayerUrl` and `sessionId` options
- Parse JSON strings: `typeof x === 'string' ? JSON.parse(x) : x`
- Use `{ data, error }` pattern from sap-client
- Throw on error for Directus Flow error handling
- Register in `package.json` entries array
