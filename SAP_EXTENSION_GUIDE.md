# Directus Extension: SAP Service Layer Operations

## Overview

A Directus **Operations bundle extension** that provides reusable flow operations for communicating with SAP Business One Service Layer. These operations plug into Directus Flows, allowing no-code orchestration of SAP integration (event-driven sync, scheduled jobs, manual triggers).

---

## Architecture

### Extension Type
- **Bundle** containing multiple **Operations**
- Each operation is a self-contained step usable in any Directus Flow
- Shared SAP session management across operations within a single flow run

### SAP Service Layer Basics
- REST API exposed by SAP Business One (typically at `https://<host>:50000/b1s/v1/`)
- **Session-based auth** — `POST /Login` returns a `B1SESSION` cookie (valid ~30 minutes)
- All subsequent requests must include the `B1SESSION` cookie
- Responses are JSON; supports OData query parameters (`$filter`, `$select`, `$top`, `$skip`, `$orderby`)
- SSL certificate is often self-signed in dev/on-prem environments

### Data Flow Pattern
```
Directus Flow trigger (event / schedule / manual / webhook)
  → [SAP Login] — authenticates, returns session ID
  → [SAP Operation] — uses session from $last or named step
  → [SAP Operation] — chain as many as needed
  → [Log / Update Directus] — store results, SAP doc numbers, etc.
```

---

## Operations Spec

### 1. SAP Login (`sap-login`)

Authenticates with SAP Service Layer and returns a session ID for downstream operations.

**Options (Flow UI):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL (e.g., `https://10.1.3.50:50000/b1s/v1`) |
| `companyDB` | String | Yes | SAP company database name |
| `userName` | String | Yes | SAP username |
| `password` | String | Yes | SAP password |

**Behavior:**
1. `POST {serviceLayerUrl}/Login` with body `{ CompanyDB, UserName, Password }`
2. Extract `B1SESSION` from response (returned in both cookie and response body as `SessionId`)
3. Return `{ sessionId, sessionTimeout }` for downstream operations

**Error handling:**
- Connection refused → reject with connection error
- 401/invalid credentials → reject with auth error
- SSL errors → option to allow self-signed certs (`rejectUnauthorized: false` for dev)

**Implementation notes:**
- Use `node-fetch` or `undici` (Node 18+ built-in)
- Must handle self-signed SSL certs (common in SAP on-prem)
- Session ID is passed to subsequent operations via Flow's data chain (`$last.sessionId` or named operation reference)

---

### 2. SAP Query (`sap-query`)

Generic GET operation for querying any SAP Service Layer entity.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL |
| `sessionId` | String | Yes | From login step (supports Flow variable syntax: `{{$last.sessionId}}`) |
| `entity` | String | Yes | SAP entity name (e.g., `BusinessPartners`, `Items`, `PurchaseOrders`) |
| `queryParams` | JSON/String | No | OData params: `$filter`, `$select`, `$top`, `$skip`, `$orderby` |

**Behavior:**
1. `GET {serviceLayerUrl}/{entity}?{queryParams}` with `Cookie: B1SESSION={sessionId}`
2. Return the parsed JSON response (`{ value: [...] }`)

**Common entity examples:**
```
BusinessPartners?$filter=CardType eq 'S'&$select=CardCode,CardName&$top=50
Items?$filter=ItemCode eq 'A00001'
PurchaseOrders?$filter=DocDate ge '2026-01-01'
```

---

### 3. SAP Create Business Partner (`sap-create-bp`)

Creates a customer or supplier in SAP from Directus `business_partners` data.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL |
| `sessionId` | String | Yes | From login step |
| `cardType` | Select | Yes | `C` (Customer), `S` (Supplier), `L` (Lead) |
| `cardCode` | String | No | SAP card code (auto-generated if blank) |
| `cardName` | String | Yes | Company/partner name |
| `payload` | JSON | No | Additional SAP fields (addresses, contact employees, etc.) |

**Behavior:**
1. Build the SAP BusinessPartner object merging required fields + payload overrides
2. `POST {serviceLayerUrl}/BusinessPartners` with `Cookie: B1SESSION={sessionId}`
3. Return created BP including SAP-assigned `CardCode` and `DocEntry`

**Field mapping (Directus → SAP):**

| Directus (`business_partners`) | SAP (`BusinessPartners`) |
|-------------------------------|--------------------------|
| `company_name` | `CardName` |
| `relationship_type` = customer | `CardType` = `C` |
| `relationship_type` = supplier | `CardType` = `S` |
| `status` | `Frozen` (`Y`/`N`) |
| `website` | `Website` |
| `phone` | `Phone1` |
| `email` | `EmailAddress` |

---

### 4. SAP Update Business Partner (`sap-update-bp`)

Updates an existing SAP Business Partner.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL |
| `sessionId` | String | Yes | From login step |
| `cardCode` | String | Yes | SAP CardCode to update |
| `payload` | JSON | Yes | Fields to update |

**Behavior:**
1. `PATCH {serviceLayerUrl}/BusinessPartners('{cardCode}')` with payload
2. SAP returns 204 No Content on success
3. Return `{ success: true, cardCode }`

---

### 5. SAP Create Purchase Order (`sap-create-po`)

Creates a Purchase Order in SAP.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL |
| `sessionId` | String | Yes | From login step |
| `cardCode` | String | Yes | Supplier card code |
| `docDate` | String | No | Document date (defaults to today) |
| `lines` | JSON | Yes | Array of `{ ItemCode, Quantity, UnitPrice, WarehouseCode }` |
| `payload` | JSON | No | Additional header-level fields |

**Behavior:**
1. Build PO object with `CardCode`, `DocDate`, `DocumentLines`
2. `POST {serviceLayerUrl}/PurchaseOrders`
3. Return created PO including `DocEntry` and `DocNum`

---

### 6. SAP Sync Items (`sap-sync-items`)

Pulls item/inventory data from SAP into Directus.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceLayerUrl` | String | Yes | Base URL |
| `sessionId` | String | Yes | From login step |
| `filter` | String | No | OData `$filter` expression |
| `top` | Number | No | Max records to pull (default: 100) |

**Behavior:**
1. `GET {serviceLayerUrl}/Items?$filter={filter}&$top={top}`
2. Return array of SAP items

**Field mapping (SAP → Directus):**

| SAP (`Items`) | Directus (`items`) |
|---------------|-------------------|
| `ItemCode` | `sku` or `mpn` |
| `ItemName` | `description` |
| `Manufacturer` | lookup `manufacturers` by name |
| `QuantityOnStock` | `quantity_on_hand` |
| `AvgStdPrice` | `cost_price` |

---

## Project Structure

```
sap-service-layer/
├── package.json
├── src/
│   ├── index.js              # Bundle entry — registers all operations
│   ├── shared/
│   │   ├── sap-client.js     # Shared HTTP client (session handling, SSL, error normalization)
│   │   └── constants.js      # SAP entity names, card types, etc.
│   ├── login/
│   │   ├── api.js            # Operation handler
│   │   └── app.js            # Options UI (Vue component for Flow builder)
│   ├── query/
│   │   ├── api.js
│   │   └── app.js
│   ├── create-bp/
│   │   ├── api.js
│   │   └── app.js
│   ├── update-bp/
│   │   ├── api.js
│   │   └── app.js
│   ├── create-po/
│   │   ├── api.js
│   │   └── app.js
│   └── sync-items/
│       ├── api.js
│       └── app.js
```

### `package.json`

```json
{
  "name": "directus-extension-sap-service-layer",
  "version": "1.0.0",
  "type": "module",
  "directus:extension": {
    "type": "bundle",
    "path": {
      "app": "dist/app.js",
      "api": "dist/api.js"
    },
    "entries": [
      { "type": "operation", "name": "sap-login", "source": "src/login" },
      { "type": "operation", "name": "sap-query", "source": "src/query" },
      { "type": "operation", "name": "sap-create-bp", "source": "src/create-bp" },
      { "type": "operation", "name": "sap-update-bp", "source": "src/update-bp" },
      { "type": "operation", "name": "sap-create-po", "source": "src/create-po" },
      { "type": "operation", "name": "sap-sync-items", "source": "src/sync-items" }
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

---

## Shared SAP Client (`src/shared/sap-client.js`)

Centralized HTTP helper for all operations:

- **Session management** — attaches `B1SESSION` cookie to requests
- **SSL handling** — configurable `rejectUnauthorized` for self-signed certs
- **Error normalization** — parses SAP error responses (`{ error: { code, message: { value } } }`) into consistent format
- **Retry logic** — optional retry on 401 (session expired) with automatic re-login
- **Logging** — structured logs for debugging (entity, method, status code, duration)

```javascript
// Usage pattern inside an operation handler:
const client = createSapClient({ serviceLayerUrl, sessionId, rejectUnauthorized: false })

const { data, error } = await client.get('BusinessPartners', {
  $filter: "CardCode eq 'C001'",
  $select: 'CardCode,CardName',
})

const { data, error } = await client.post('BusinessPartners', {
  CardCode: 'C999',
  CardName: 'Test Customer',
  CardType: 'C',
})
```

---

## Environment Variables

These should be configured in the Directus environment (`.env` or Docker env), NOT hardcoded:

```env
# SAP Service Layer
SAP_SERVICE_LAYER_URL=https://10.1.3.50:50000/b1s/v1
SAP_COMPANY_DB=SBODemoUS
SAP_USERNAME=manager
SAP_PASSWORD=your-password
SAP_REJECT_UNAUTHORIZED=false
```

Operations can reference these via `process.env` as defaults, while still allowing per-flow overrides in the options UI.

---

## Flow Examples

### Example 1: Sync New Supplier to SAP (Event-Driven)

```
Trigger: Event → items.create on business_partners (where relationship_type = 'supplier')
  → [SAP Login] — authenticate
  → [SAP Create BP] — push new supplier (CardType = 'S')
  → [Run Script] — update Directus item with SAP CardCode
```

### Example 2: Nightly Item Sync (Scheduled)

```
Trigger: Schedule → cron: 0 2 * * * (2 AM daily)
  → [SAP Login] — authenticate
  → [SAP Sync Items] — pull updated items from SAP
  → [Run Script] — upsert into Directus items collection
```

### Example 3: Manual PO Push

```
Trigger: Manual → on purchase_orders collection
  → [SAP Login] — authenticate
  → [SAP Create PO] — push PO with line items
  → [Run Script] — store SAP DocNum back in Directus
```

---

## Development Workflow

### Setup
```bash
npx create-directus-extension@latest
# Select: bundle
# Name: sap-service-layer
cd sap-service-layer
npm install
```

### Development
```bash
npm run dev    # Watch mode — rebuilds on file changes
```

The built extension goes into `dist/`. For local Directus development, symlink or copy to `<directus-project>/extensions/`.

### Testing
- Use SAP dev instance with test company DB
- Start with `sap-login` → verify session cookie works
- Test each operation individually via manual trigger flows
- Verify error paths: wrong credentials, invalid entity, network timeout

### Deployment
```bash
npm run build
# Copy dist/ to Directus extensions directory
# Restart Directus
```

---

## SAP Service Layer Reference

### Authentication
```
POST /b1s/v1/Login
Body: { "CompanyDB": "SBODemoUS", "UserName": "manager", "Password": "secret" }
Response: { "SessionId": "abc123", "SessionTimeout": 30 }
```

### Common Entities
| Entity | Description |
|--------|-------------|
| `BusinessPartners` | Customers, Suppliers, Leads |
| `Items` | Inventory items |
| `PurchaseOrders` | Purchase orders |
| `Orders` | Sales orders |
| `Invoices` | A/R Invoices |
| `DeliveryNotes` | Delivery documents |
| `StockTransfers` | Warehouse transfers |
| `JournalEntries` | Accounting entries |

### OData Query Examples
```
# Get active suppliers
BusinessPartners?$filter=CardType eq 'S' and Frozen eq 'N'&$select=CardCode,CardName,Phone1

# Get items by manufacturer
Items?$filter=Manufacturer eq 42&$top=100

# Get recent POs
PurchaseOrders?$filter=DocDate ge '2026-01-01'&$orderby=DocDate desc&$top=50
```

### Common Gotchas
- **Self-signed SSL** — SAP on-prem almost always uses self-signed certs; must handle in HTTP client
- **Session timeout** — default 30 min; re-authenticate if 401 response
- **PATCH not PUT** — use PATCH for updates; PUT replaces the entire entity
- **String keys** — CardCode and some keys are strings, not integers: `BusinessPartners('C001')` not `BusinessPartners(1)`
- **Batch requests** — SAP supports `POST /b1s/v1/$batch` for multiple operations in one request (useful for bulk sync)

---

## CLAUDE.md Instructions (for extension project)

When working in the SAP extension project, Claude should follow these rules:

```markdown
# CLAUDE.md — SAP Service Layer Extension

## Project Type
Directus bundle extension containing SAP Service Layer operations for use in Directus Flows.

## Commands
- `npm run build` — Build the extension
- `npm run dev` — Watch mode (rebuilds on change)

## Rules
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
```

---

**Document Version:** 1.0
**Created:** March 3, 2026
**Status:** Spec — ready for implementation
