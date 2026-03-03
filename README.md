# directus-extension-sap-service-layer

A Directus bundle extension that provides SAP Business One Service Layer operations for use in Directus Flows.

## Operations

| Operation | Description |
|-----------|-------------|
| **SAP Login** | Authenticate with SAP Service Layer and obtain a session ID |
| **SAP Logout** | End a SAP Service Layer session |
| **SAP Request** | Send GET, POST, PATCH, or DELETE to any SAP entity |

A hook (`sap-auto-login`) automatically pre-warms the SAP session when a user logs into Directus.

## Installation

Copy the built extension into your Directus extensions directory:

```
extensions/
  directus-extension-sap-service-layer/
    package.json
    dist/
      api.js
      app.js
```

Restart Directus. The three operations will appear in the Flow operation picker.

## Configuration

### Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SAP_SERVICE_LAYER_URL` | Yes (or per-user) | Base URL, e.g. `https://10.1.3.50:50000/b1s/v1` |
| `SAP_COMPANY_DB` | Yes (or per-user) | SAP company database name, e.g. `MYDB` |
| `SECRET` | Yes | Directus `SECRET` — used to encrypt SAP passwords at rest |

### Per-User SAP Credentials (`directus_users`)

These custom fields must exist on the `directus_users` collection:

| Field | Type | Description |
|-------|------|-------------|
| `sap_service_layer_url` | String | Overrides `SAP_SERVICE_LAYER_URL` for this user |
| `sap_company_db` | String | Overrides `SAP_COMPANY_DB` for this user |
| `sap_username` | String | SAP username |
| `sap_password` | String | SAP password — automatically encrypted before save |

**Priority:** operation option > user profile field > environment variable.

## Usage Modes

### Mode 1 — Session Pool (recommended)

Enable **Use Session Pool** on the SAP Request operation (default). Sessions are managed automatically:

1. User logs into Directus → hook pre-warms SAP session.
2. SAP Request uses the cached session — no Login step needed in flows.
3. On 401 (session expired), the operation re-authenticates and retries once.

No SAP Login or SAP Logout steps are required in flows.

### Mode 2 — Explicit Session

Disable **Use Session Pool**. Manage sessions manually in flows:

1. **SAP Login** → returns `{ sessionId, sessionTimeout }`
2. **SAP Request** → use `{{$last.sessionId}}` as the Session ID input
3. **SAP Logout** → end the session when done

## Building

```bash
npm install
npm run build   # production build → dist/
npm run dev     # watch mode
npm run lint    # ESLint
npm run format  # Prettier
```
