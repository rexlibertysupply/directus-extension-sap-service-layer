---
name: directus-extensions-ref
description: Directus extension development reference for operations bundles. Load when building or modifying operation handlers, app UIs, or shared modules.
user-invocable: false
---

# Directus Extension Development Reference

## Build System

- Uses **Rollup** (not Vite) via `@directus/extensions-sdk` CLI
- `npm run build` → `directus-extension build` → reads `package.json` `"directus:extension"` key
- Bundle builds generate a virtual entrypoint that imports all entries and produces `dist/app.js` + `dist/api.js`
- Output is ESM (`"type": "module"` in package.json)
- `extension.config.js` at project root can add Rollup plugins and watch options

### Externals (NOT bundled — host provides them)

**App side:** `@directus/extensions-sdk`, `vue`, `vue-router`, `vue-i18n`, `pinia`
**API side:** `directus`, `directus:api`

Everything else you import gets bundled inline.

---

## Operation Handler (`api.js`)

```javascript
export default {
  id: 'operation-id',
  handler: async (options, context) => {
    // Return value → Resolve path, becomes $last for next step
    // Throw → Reject path
    return { result: 'value' };
  },
};
```

### Handler Arguments

**`options`** — field values from Flow UI, keys match `field` names in `app.js`

**`context`** object:

| Property | Type | Description |
|---|---|---|
| `services` | `object` | All Directus services (`ItemsService`, `MailService`, etc.) |
| `database` | `Knex` | Raw Knex DB instance |
| `getSchema` | `async fn` | Returns current DB schema — **always await before using services** |
| `env` | `object` | Directus env vars |
| `logger` | `pino.Logger` | Logger instance (`logger.info()`, `.warn()`, `.error()`) |
| `data` | `object` | All previous step outputs; `data.$trigger` = trigger payload, `data.$last` = previous step |
| `accountability` | `object\|null` | Current user context; `null` for scheduled flows |

### Using Directus Services

```javascript
handler: async ({ collection }, { services, database, getSchema, accountability }) => {
  const { ItemsService } = services;
  const schema = await getSchema();  // ALWAYS await first

  // With user permissions:
  const svc = new ItemsService(collection, { schema, accountability, knex: database });

  // Admin access (no accountability):
  const adminSvc = new ItemsService(collection, { schema });

  // CRUD:
  const id = await svc.createOne({ name: 'New' });
  const item = await svc.readOne(id);
  const items = await svc.readByQuery({
    filter: { status: { _eq: 'active' } },
    fields: ['id', 'name'],
    limit: 25,
    sort: ['-date_created'],
  });
  await svc.updateOne(id, { name: 'Updated' });
  await svc.deleteOne(id);
}
```

### Available Services

`ItemsService`, `CollectionsService`, `FieldsService`, `RelationsService`, `FilesService`,
`UsersService`, `RolesService`, `MailService`, `SettingsService`, `PermissionsService`,
`ActivityService`, `RevisionsService`, `AuthenticationService`, `AssetsService`,
`NotificationsService`, `FlowsService`, `OperationsService`

All use: `new ServiceName({ schema, accountability, knex: database })`

### Error Handling

```javascript
// Triggers Reject path in Flow:
throw new Error('Something failed');

// Structured error:
throw { code: 'SAP_ERROR', message: 'Session expired', statusCode: 401 };
```

Return value or thrown value is accessible in subsequent steps via `{{operation_key.field}}` templates.

---

## Operation UI (`app.js`)

```javascript
export default {
  id: 'operation-id',         // must match api.js id
  name: 'Display Name',
  icon: 'material_icon_name',
  description: 'Short description.',
  overview: ({ field1, field2 }) => [
    { label: 'Label', text: field1 },
  ],
  options: [ /* field definitions */ ],
};
```

### Field Definition Structure

```javascript
{
  field: 'fieldName',        // key passed to handler
  name: 'Display Label',
  type: 'string',           // see types below
  required: true,           // optional
  schema: {                 // optional
    default_value: 'foo',
  },
  meta: {
    width: 'full',           // 'full' | 'half'
    interface: 'input',      // UI component
    note: 'Helper text',
    options: { ... },        // interface-specific
    group: 'groupName',     // for collapsible groups
    masked: true,           // for password fields on 'input'
  },
}
```

### Field Types

`string`, `text`, `integer`, `float`, `boolean`, `json`, `uuid`, `alias` (grouping)

### Interfaces

| Interface | Use | Key Options |
|---|---|---|
| `input` | Text input | `placeholder`, `masked: true` (passwords), `trim` |
| `input-code` | Code editor | `language: 'json'\|'javascript'`, `placeholder`, `template` |
| `input-multiline` | Textarea | `placeholder` |
| `select-dropdown` | Dropdown | `choices: [{text, value}]`, `allowNone`, `placeholder` |
| `select-radio` | Radio buttons | `choices: [{text, value}]` |
| `select-multiple-checkbox` | Multi-select | `choices: [{text, value}]` |
| `boolean` / `toggle` | Toggle switch | — |
| `slider` | Number slider | `minValue`, `maxValue`, `stepInterval`, `alwaysShowValue` |
| `datetime` | Date picker | — |
| `list` | Repeater | `fields` (nested field defs), `template` |
| `group-detail` | Collapsible section | `start: 'open'\|'closed'` (type must be `alias`) |
| `presentation-notice` | Info box | `text`, `color` |

### Collapsible Group Example

```javascript
// Group container (type alias):
{
  field: 'advanced',
  name: 'Advanced Settings',
  type: 'alias',
  meta: {
    special: ['alias', 'no-data', 'group'],
    interface: 'group-detail',
    options: { start: 'closed' },
    width: 'full',
  },
},
// Fields inside the group:
{
  field: 'timeout',
  name: 'Timeout',
  type: 'integer',
  meta: { width: 'half', interface: 'input', group: 'advanced' },
}
```

### Dynamic Options (function form)

```javascript
options: (currentValues) => [
  { field: 'mode', name: 'Mode', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [...] } } },
  // Show extra field only when mode = 'advanced':
  ...(currentValues.mode === 'advanced' ? [
    { field: 'extra', name: 'Extra', type: 'string', meta: { interface: 'input' } }
  ] : []),
],
```

---

## Bundle `package.json`

```json
{
  "name": "directus-extension-my-bundle",
  "version": "1.0.0",
  "type": "module",
  "directus:extension": {
    "type": "bundle",
    "host": "^10.0.0 || ^11.0.0",
    "path": { "app": "dist/app.js", "api": "dist/api.js" },
    "entries": [
      {
        "type": "operation",
        "name": "my-op",
        "source": { "app": "src/my-op/app.js", "api": "src/my-op/api.js" }
      }
    ]
  },
  "scripts": {
    "build": "directus-extension build",
    "dev": "directus-extension build -w --no-minify"
  },
  "devDependencies": {
    "@directus/extensions-sdk": "^12.0.0"
  }
}
```

- Operations use `source: { app, api }` (split entrypoint)
- Hooks/endpoints use `source: "path/to/file.js"` (single entrypoint)
- Entry `name` values must be unique
- `host` is semver range for Directus compatibility
- `partial: true` (optional) lets entries be individually disabled in admin

---

## App-Side Composables

Available via `import { ... } from '@directus/extensions-sdk'`:

| Composable | Returns |
|---|---|
| `useApi()` | Axios instance for Directus REST API |
| `useSdk()` | Directus SDK client |
| `useStores()` | All Directus Pinia stores |
| `useExtensions()` | Loaded extensions registry |
| `useCollection(key)` | Collection info, fields, defaults, primary key |
| `useItems(collection, query)` | Items with loading/error state |

---

## Best Practices

1. **Always `await getSchema()`** before instantiating services
2. **Pass `accountability`** to enforce user permissions; omit for admin access
3. **Use `logger`** not `console.log` — integrates with Directus logging
4. **Use `env`** for secrets — `context.env.MY_KEY`, never hardcode
5. **Return structured objects** — downstream steps access via `{{step_key.field}}`
6. **Throw to reject** — triggers the Reject path in Flows
7. **Parse JSON inputs** — options may arrive as strings: `typeof x === 'string' ? JSON.parse(x) : x`
8. **Shared code in `src/shared/`** — bundled and tree-shaken automatically
9. **ES modules only** — use `import`, not `require()`
10. **Prevent recursion** in event-triggered flows: `{ emitEvents: false }` on service calls
